'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { processImage } from '@/lib/image-client';
import { MAX_IMAGE, MAX_VIDEO, MAX_PDF, MULTIPART_FROM } from '@/lib/limits';
import { thumbName } from '@/lib/media-url';

const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VID_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const VID_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const thumb = (f) => thumbName(f);
const hex = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const safeName = (n) => (n.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'brochure') + '.pdf';

async function api(url, method, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Something went wrong.'); e.status = r.status; throw e; }
  return j;
}

const blank = { name: '', tagline: '', client: '', category: '', delivered: '', details: '' };

export default function AdminClient({ projects }) {
  const router = useRouter();
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(blank);
  const [features, setFeatures] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkIn, setLinkIn] = useState('');
  const [files, setFiles] = useState([]); // { file, kind, url }
  const [msg, setMsg] = useState({ text: '', err: false });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [armed, setArmed] = useState(null);
  const armTimer = useRef(null);
  const imgIn = useRef(null), vidIn = useRef(null), pdfIn = useRef(null), formRef = useRef(null);

  const current = editing ? projects.find((p) => p.id === editing) : null;
  const say = (text, err = false) => setMsg({ text, err });
  const set = (k) => (e) => setF((c) => ({ ...c, [k]: e.target.value }));
  const newPdf = files.find((x) => x.kind === 'pdf');

  useEffect(() => () => { files.forEach((x) => x.url && URL.revokeObjectURL(x.url)); }, []); // eslint-disable-line

  function reset() {
    files.forEach((x) => x.url && URL.revokeObjectURL(x.url));
    setEditing(null); setF(blank); setFeatures([]); setLinks([]); setLinkIn(''); setFiles([]);
    [imgIn, vidIn, pdfIn].forEach((r) => { if (r.current) r.current.value = ''; });
  }
  function startEdit(p) {
    reset();
    setEditing(p.id);
    setF({ name: p.name, tagline: p.tagline, client: p.client, category: p.category, delivered: p.delivered, details: p.details });
    setFeatures(p.features.map((x) => ({ ...x })));
    setLinks(p.links.map((l) => l.url));
    say('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pick(ev, kind) {
    const types = kind === 'image' ? IMG_TYPES : kind === 'video' ? VID_TYPES : ['application/pdf'];
    const max = kind === 'image' ? MAX_IMAGE : kind === 'video' ? MAX_VIDEO : MAX_PDF;
    const bad = [], added = [];
    for (const file of Array.from(ev.target.files || [])) {
      if (!types.includes(file.type)) bad.push(`${file.name} is not a supported ${kind === 'pdf' ? 'PDF' : kind} file.`);
      else if (file.size > max) bad.push(`${file.name} is over ${Math.round(max / 1048576)} MB.`);
      else added.push({ file, kind, url: kind === 'image' ? URL.createObjectURL(file) : null });
    }
    ev.target.value = '';
    setFiles((cur) => kind === 'pdf' && added.length ? cur.filter((x) => x.kind !== 'pdf').concat(added.slice(0, 1)) : cur.concat(added));
    say(bad.join(' '), bad.length > 0);
  }
  function addLink() {
    const u = linkIn.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) return say('Enter a full link starting with https://', true);
    setLinks((l) => l.concat(u)); setLinkIn(''); say('');
  }
  const setFeature = (i, k, v) => setFeatures((c) => c.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  // Sends one file straight from the browser to Vercel Blob.
  const send = (pathname, body, contentType, onProgress, big) =>
    upload(pathname, body, {
      access: 'public', handleUploadUrl: '/api/upload', contentType,
      multipart: big, onUploadProgress: (e) => onProgress?.(e.loaded),
    });

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    if (!f.name.trim()) return say('Enter a project name.', true);
    setBusy(true); say('Saving…');
    let id = editing;
    try {
      const payload = { ...f, features: features.filter((x) => x.t.trim()), links };
      if (id) await api(`/api/projects/${id}`, 'PUT', payload);
      else id = (await api('/api/projects', 'POST', payload)).id;

      const total = files.reduce((n, x) => n + x.file.size, 0) || 1;
      let before = 0;
      const failed = [];
      for (let i = 0; i < files.length; i++) {
        const x = files[i];
        const tick = (loaded) => setProgress({ done: i, total: files.length, pct: Math.min(100, Math.round(((before + loaded) / total) * 100)) });
        tick(0);
        try {
          const mid = hex(12);
          if (x.kind === 'image') {
            const p = await processImage(x.file);
            const base = `media/${mid}`;
            const [bigR] = await Promise.all([
              send(`${base}.${p.ext}`, p.big, p.type),
              send(`${base}_t.${p.ext}`, p.thumb, p.type),
            ]);
            await api(`/api/projects/${id}/media/commit`, 'POST', { kind: 'image', file: bigR.url, name: x.file.name, size: p.big.size, w: p.w, h: p.h, color: p.color });
          } else if (x.kind === 'video') {
            const r = await send(`media/${mid}.${VID_EXT[x.file.type]}`, x.file, x.file.type, tick, x.file.size > MULTIPART_FROM);
            await api(`/api/projects/${id}/media/commit`, 'POST', { kind: 'video', file: r.url, name: x.file.name, size: x.file.size });
          } else {
            const r = await send(`media/${mid}/${safeName(x.file.name)}`, x.file, 'application/pdf', tick, x.file.size > MULTIPART_FROM);
            await api(`/api/projects/${id}/media/commit`, 'POST', { kind: 'pdf', file: r.url, name: x.file.name, size: x.file.size });
          }
        } catch (er) { failed.push(`${x.file.name}: ${er.message}`); }
        before += x.file.size;
      }
      setProgress(null);
      const wasEdit = !!editing;
      reset(); router.refresh();
      if (failed.length) say(`Saved, but ${failed.length} file${failed.length === 1 ? '' : 's'} failed. ${failed.join(' ')}`, true);
      else say(wasEdit ? 'Changes saved.' : 'Project added. It now appears on the website.');
    } catch (er) {
      setProgress(null);
      if (er.status === 401) router.refresh();
      say(er.message, true);
    }
    setBusy(false);
  }

  async function removeMedia(pid, mid) {
    try { await api(`/api/projects/${pid}/media/${mid}`, 'DELETE'); router.refresh(); }
    catch (er) { say(er.message, true); }
  }
  async function makeCover(pid, mid) {
    try { await api(`/api/projects/${pid}/media/${mid}`, 'PATCH', { cover: true }); router.refresh(); say('Cover photo updated.'); }
    catch (er) { say(er.message, true); }
  }
  function deleteProject(id) {
    if (armed !== id) { setArmed(id); clearTimeout(armTimer.current); armTimer.current = setTimeout(() => setArmed(null), 4000); return; }
    setArmed(null); clearTimeout(armTimer.current);
    api(`/api/projects/${id}`, 'DELETE')
      .then(() => { if (editing === id) reset(); router.refresh(); say('Project deleted.'); })
      .catch((er) => say(er.message, true));
  }
  async function move(i, dir) {
    const ids = projects.map((p) => p.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try { await api('/api/projects/order', 'POST', { ids }); router.refresh(); say('Order saved. This is the order visitors see.'); }
    catch (er) { say(er.message, true); }
  }
  async function logout() { await fetch('/api/login', { method: 'DELETE' }); router.refresh(); }

  return (
    <>
      <div className="admin-top">
        <div><p className="eyebrow">ATS admin</p><h1 className="h-sm">Manage projects</h1></div>
        <button type="button" className="btn small" onClick={logout}>Log out</button>
      </div>

      <div className="admin-grid">
        <form className="panel" onSubmit={save} ref={formRef} noValidate>
          <h2>{editing ? 'Edit project' : 'Add a project'}</h2>

          <div>
            <label htmlFor="f-name">Project name</label>
            <input id="f-name" className="field" maxLength={120} autoComplete="off" value={f.name} onChange={set('name')} />
          </div>
          <div>
            <label htmlFor="f-tag">Headline</label>
            <input id="f-tag" className="field" maxLength={160} placeholder="One line that sums the project up" autoComplete="off" value={f.tagline} onChange={set('tagline')} />
          </div>
          <div className="two">
            <div><label htmlFor="f-client">Client</label><input id="f-client" className="field" maxLength={120} autoComplete="off" value={f.client} onChange={set('client')} /></div>
            <div><label htmlFor="f-cat">Category</label><input id="f-cat" className="field" maxLength={80} autoComplete="off" value={f.category} onChange={set('category')} /></div>
          </div>
          <div>
            <label htmlFor="f-delivered">Delivered</label>
            <input id="f-delivered" className="field" maxLength={40} placeholder="e.g. March 2025 (leave empty to use the date it was added)" autoComplete="off" value={f.delivered} onChange={set('delivered')} />
          </div>
          <div>
            <label htmlFor="f-details">Details</label>
            <textarea id="f-details" className="field" maxLength={8000} placeholder="What the project is, where, when, who it was for, what was delivered." value={f.details} onChange={set('details')} />
            <p className="hint">Leave a blank line between paragraphs.</p>
          </div>

          <div>
            <span className="lbl">Key features</span>
            <div className="fe-list">
              {features.map((x, i) => (
                <div className="fe" key={i}>
                  <span className="fe-n">{String(i + 1).padStart(2, '0')}</span>
                  <input className="field" maxLength={80} placeholder="Feature" aria-label={`Feature ${i + 1} title`} value={x.t} onChange={(e) => setFeature(i, 't', e.target.value)} />
                  <input className="field" maxLength={400} placeholder="Short description" aria-label={`Feature ${i + 1} description`} value={x.d} onChange={(e) => setFeature(i, 'd', e.target.value)} />
                  <button type="button" className="x" onClick={() => setFeatures((c) => c.filter((_, j) => j !== i))} aria-label="Remove feature">×</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn small" disabled={features.length >= 12} onClick={() => setFeatures((c) => c.concat({ t: '', d: '' }))}>+ Add key feature</button>
          </div>

          <div>
            <label htmlFor="f-images">Images</label>
            <input id="f-images" ref={imgIn} type="file" accept={IMG_TYPES.join(',')} multiple onChange={(e) => pick(e, 'image')} />
            <p className="hint">JPG, PNG, WebP or GIF, up to 25 MB each. Photos are resized in your browser before upload. The first photo is the cover.</p>
          </div>

          {current && current.images.length > 0 && (
            <div>
              <span className="lbl">Current photos</span>
              <div className="tray">
                {current.images.map((m, i) => (
                  <div className="chip" key={m.id}>
                    <img src={thumb(m.file)} alt="" />
                    {i === 0 && <span className="badge">Cover</span>}
                    <button type="button" className="x" onClick={() => removeMedia(current.id, m.id)} aria-label="Remove photo">×</button>
                    {i !== 0 && <button type="button" className="mk" onClick={() => makeCover(current.id, m.id)}>Make cover</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {files.some((x) => x.kind === 'image') && (
            <div className="tray">
              {files.map((x, i) => x.kind === 'image' && (
                <div className="chip" key={i}>
                  <img src={x.url} alt="" /><span className="badge">New</span>
                  <button type="button" className="x" onClick={() => { URL.revokeObjectURL(x.url); setFiles((c) => c.filter((_, j) => j !== i)); }} aria-label="Remove photo">×</button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label htmlFor="f-videos">Videos</label>
            <input id="f-videos" ref={vidIn} type="file" accept={VID_TYPES.join(',')} multiple onChange={(e) => pick(e, 'video')} />
            <p className="hint">MP4, WebM or MOV, up to {Math.round(MAX_VIDEO / 1048576)} MB each. MP4 plays in every browser.</p>
            <label htmlFor="f-link" className="gap-top">Video link (YouTube or Vimeo play on the page)</label>
            <div className="row">
              <input id="f-link" type="url" className="field" placeholder="https://" value={linkIn} onChange={(e) => setLinkIn(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
              <button type="button" className="btn" onClick={addLink}>Add link</button>
            </div>
          </div>

          {(current?.videos.length > 0 || links.length > 0 || files.some((x) => x.kind === 'video')) && (
            <ul className="vlist">
              {current?.videos.map((v) => (
                <li className="vitem" key={v.id}><span>{v.name || 'Video file'}</span><span className="tag">File</span>
                  <button type="button" className="x" onClick={() => removeMedia(current.id, v.id)} aria-label="Remove video">×</button></li>
              ))}
              {links.map((u, i) => (
                <li className="vitem" key={u + i}><span>{u}</span><span className="tag">Link</span>
                  <button type="button" className="x" onClick={() => setLinks((l) => l.filter((_, j) => j !== i))} aria-label="Remove link">×</button></li>
              ))}
              {files.map((x, i) => x.kind === 'video' && (
                <li className="vitem" key={'n' + i}><span>{x.file.name}</span><span className="tag">New file</span>
                  <button type="button" className="x" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} aria-label="Remove video">×</button></li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor="f-pdf">Brochure (PDF)</label>
            <input id="f-pdf" ref={pdfIn} type="file" accept="application/pdf" onChange={(e) => pick(e, 'pdf')} />
            <p className="hint">One PDF per project, up to {Math.round(MAX_PDF / 1048576)} MB. Visitors can preview and download it. Uploading a new one replaces the old one.</p>
            {(current?.brochure || newPdf) && (
              <ul className="vlist">
                {current?.brochure && !newPdf && (
                  <li className="vitem"><span>{current.brochure.name || 'Brochure.pdf'}</span><span className="tag">PDF</span>
                    <button type="button" className="x" onClick={() => removeMedia(current.id, current.brochure.id)} aria-label="Remove brochure">×</button></li>
                )}
                {newPdf && (
                  <li className="vitem"><span>{newPdf.file.name}</span><span className="tag">New PDF</span>
                    <button type="button" className="x" onClick={() => setFiles((c) => c.filter((x) => x.kind !== 'pdf'))} aria-label="Remove brochure">×</button></li>
                )}
              </ul>
            )}
          </div>

          {progress && (
            <div>
              <progress max="100" value={progress.pct} />
              <p className="hint">Uploading file {Math.min(progress.done + 1, progress.total)} of {progress.total} · {progress.pct}%</p>
            </div>
          )}

          <div className="actions">
            <button type="submit" className="btn primary" disabled={busy}>{editing ? 'Save changes' : 'Add project'}</button>
            {editing && <button type="button" className="btn" onClick={() => { reset(); say(''); }} disabled={busy}>Cancel edit</button>}
            <span className={`msg${msg.err ? ' err' : ''}`} role="status">{msg.text}</span>
          </div>
        </form>

        <div className="panel">
          <h2>All projects</h2>
          {projects.length > 1 && <p className="hint">Use ▲ ▼ to arrange the order. The website shows projects in this order.</p>}
          {projects.length === 0 ? (
            <p className="msg">Nothing here yet. Projects you add appear in this list and on the website.</p>
          ) : (
            <div className="manage">
              {projects.map((p, i) => (
                <div className="mrow" key={p.id}>
                  <div className="mthumb">{p.cover ? <img src={thumb(p.cover.file)} alt="" /> : p.name.charAt(0).toUpperCase()}</div>
                  <div className="mtext">
                    <div className="mname">{p.name}</div>
                    <div className="mono muted">{new Date(p.created_at).getFullYear()} · {p.images.length} photos · {p.videos.length + p.links.length} videos{p.brochure ? ' · PDF' : ''}</div>
                  </div>
                  <div className="mactions">
                    <button type="button" className="btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`}>▲</button>
                    <button type="button" className="btn small" onClick={() => move(i, 1)} disabled={i === projects.length - 1} aria-label={`Move ${p.name} down`}>▼</button>
                    <Link className="btn small" href={`/projects/${p.id}`} target="_blank">View</Link>
                    <button type="button" className="btn small" onClick={() => startEdit(p)}>Edit</button>
                    <button type="button" className={`btn small danger${armed === p.id ? ' armed' : ''}`} onClick={() => deleteProject(p.id)}>{armed === p.id ? 'Confirm delete' : 'Delete'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
