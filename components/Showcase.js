'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Pic from './Pic';
import { thumbUrl, mediaUrl } from '@/lib/media-url';
import ProjectView from './ProjectView';
import { counts } from '@/lib/format';

const thumb = thumbUrl;
const big = mediaUrl;
const year = (p) => p.delivered || new Date(p.created_at).getFullYear();
const pad = (n) => String(n).padStart(2, '0');
const excerpt = (t) => (t.length > 190 ? t.slice(0, 187).trimEnd() + '…' : t);
const rectOf = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

/** The big image stack for one project: the cover plus up to two more photos behind it for depth. */
function Art({ p, leaving, onOpen }) {
  const [a, b, c] = p.images;
  const layers = [b, c].filter(Boolean).length;
  return (
    <div className={`art l${layers}${leaving ? ' leaving' : ''}`} aria-hidden={leaving || undefined}>
      {c && (
        <div className="art-layer d3"><div className="art-card" style={{ '--ph': c.color || undefined }}><Pic src={thumb(c.file)} alt="" width={c.w} height={c.h} /></div></div>
      )}
      {b && (
        <div className="art-layer d2"><div className="art-card" style={{ '--ph': b.color || undefined }}><Pic src={thumb(b.file)} alt="" width={b.w} height={b.h} /></div></div>
      )}
      <div className="art-layer d1">
        <button type="button" className="art-card main" data-pid={leaving ? undefined : p.id} onClick={onOpen} tabIndex={leaving ? -1 : 0} aria-label={`Open ${p.name}`} style={{ '--ph': a?.color || undefined }}>
          {a && <img className="art-bg" src={thumb(a.file)} alt="" aria-hidden="true" />}
          {a ? (
            <Pic
              src={big(a.file)}
              srcSet={`${thumb(a.file)} 640w, ${big(a.file)} 1800w`}
              sizes="(max-width: 860px) 92vw, 56vw"
              width={a.w}
              height={a.h}
              alt=""
              fetchPriority="high"
            />
          ) : (
            <span className="art-fallback" aria-hidden="true"><b>{p.name.charAt(0).toUpperCase()}</b></span>
          )}
          <span className="art-cta">Open project <i>↗</i></span>
          {p.isNew && <span className="badge-new">New</span>}
        </button>
      </div>
    </div>
  );
}

function AllPanel({ projects, onPick, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? projects.filter((p) => p.name.toLowerCase().includes(s) || p.details.toLowerCase().includes(s)) : projects;
  }, [q, projects]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="allp" role="dialog" aria-modal="true" aria-label="All projects">
      <div className="allp-in">
        <div className="allp-top">
          <h2>All projects <span>{items.length}</span></h2>
          <input ref={inputRef} type="search" className="field" placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="btn small" onClick={onClose}>Close</button>
        </div>
        {items.length === 0 ? (
          <div className="allp-empty">No project matches “{q}”.</div>
        ) : (
          <div className="allp-grid">
            {items.map((p, i) => (
              <button type="button" className="ac" key={p.id} data-pid={p.id} style={{ '--i': Math.min(i, 14), '--ph': p.cover?.color || 'var(--soft)' }} onClick={(e) => onPick(p, e.currentTarget)}>
                <span className="ac-img">
                  {p.cover ? <Pic src={thumb(p.cover.file)} width={p.cover.w} height={p.cover.h} alt="" /> : <span className="ac-fallback"><b>{p.name.charAt(0).toUpperCase()}</b></span>}
                  {p.isNew && <span className="badge-new">New</span>}
                </span>
                <span className="ac-t"><b>{p.name}</b><i>{year(p)}{counts(p) ? ` · ${counts(p)}` : ''}</i></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Showcase({ projects, company, tagline, short }) {
  const n = projects.length;
  const [idx, setIdx] = useState(0);
  const [prevId, setPrevId] = useState(null);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(null);   // { id, rect, closing, pushed }
  const [all, setAll] = useState(false);
  const deckRef = useRef(null);
  const stripRef = useRef(null);
  const lastIdx = useRef(0);
  const touch = useRef(null);
  const raf = useRef(0);
  const openRef = useRef(null);

  const safe = Math.min(idx, Math.max(0, n - 1));
  const cur = projects[safe];
  const prev = prevId ? projects.find((p) => p.id === prevId) : null;
  openRef.current = open;
  const hold = hover || !!open || all;

  const go = useCallback((to) => { if (n) setIdx(((to % n) + n) % n); }, [n]);

  // remember the project we just left so it can animate out
  useEffect(() => {
    if (lastIdx.current === safe) return;
    setPrevId(projects[lastIdx.current]?.id ?? null);
    lastIdx.current = safe;
    const t = setTimeout(() => setPrevId(null), 900);
    return () => clearTimeout(t);
  }, [safe, projects]);

  // keep the chosen card in view in the rail
  useEffect(() => {
    const strip = stripRef.current, el = strip?.children[safe];
    if (el) strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
  }, [safe]);

  // ---- opening and closing a project (the address bar gets #p-<id>, so Back closes it) ----
  const openProject = useCallback((id, el) => {
    setOpen({ id, rect: rectOf(el), closing: false, pushed: true });
    try { history.pushState(null, '', `#p-${id}`); } catch { /* ignore */ }
  }, []);
  const requestClose = useCallback(() => {
    const o = openRef.current;
    if (!o || o.closing) return;
    if (o.pushed) { history.back(); return; }              // popstate below starts the closing animation
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch { /* ignore */ }
    setOpen({ ...o, closing: true });
  }, []);

  useEffect(() => {
    const fromHash = () => /^#p-([a-f0-9]+)$/.exec(window.location.hash)?.[1] || null;
    const first = fromHash();
    if (first && projects.some((p) => p.id === first)) setOpen({ id: first, rect: null, closing: false, pushed: false });
    const onPop = () => {
      const id = fromHash();
      setOpen((o) => {
        if (o && !id) return { ...o, closing: true };
        if (!o && id && projects.some((p) => p.id === id)) return { id, rect: null, closing: false, pushed: true };
        return o;
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [projects]);

  // ---- keyboard and pointer ----
  useEffect(() => {
    const onKey = (e) => {
      if (open || all) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
      if (e.key === 'ArrowRight') go(safe + 1);
      else if (e.key === 'ArrowLeft') go(safe - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, all, safe, go]);

  const onMove = (e) => {
    if (raf.current) return;
    const { clientX: x, clientY: y } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = deckRef.current;
      if (!el) return;
      el.style.setProperty('--mx', ((x / window.innerWidth) * 2 - 1).toFixed(3));
      el.style.setProperty('--my', ((y / window.innerHeight) * 2 - 1).toFixed(3));
    });
  };
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 45) go(safe + (dx < 0 ? 1 : -1));
  };

  const openCurrent = () => {
    const el = deckRef.current?.querySelector('.art:not(.leaving) .art-card.main');
    openProject(cur.id, el);
  };

  if (!n) {
    return (
      <main className="deck empty-deck">
        <h1 className="sr-only">{company} projects</h1>
        <div className="deck-empty pop">
          <p className="eyebrow">{short} · {company}</p>
          <h2>No projects yet</h2>
          <p className="deck-text">Open the Admin page and add your first project. It appears here straight away.</p>
        </div>
      </main>
    );
  }

  const words = cur.name.split(/\s+/);
  const openProj = open ? projects.find((p) => p.id === open.id) : null;

  return (
    <main className="deck" ref={deckRef} onMouseMove={onMove}>
      <h1 className="sr-only">{company} projects</h1>

      <section className="deck-main" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <div className="deck-copy">
          <p className="eyebrow pop" style={{ '--d': '.15s' }}>{short} · {company}</p>
          <div className="deck-now" key={cur.id}>
            <p className="deck-kicker">{pad(safe + 1)} / {pad(n)} · {year(cur)}</p>
            <h2 className={`deck-title${cur.name.length > 26 ? ' long' : ''}`}>
              {words.map((w, i) => <span className="w" key={i}><span style={{ '--i': i }}>{w}</span></span>)}
            </h2>
            {(cur.tagline || cur.details) && <p className="deck-text">{cur.tagline || excerpt(cur.details)}</p>}
            <div className="deck-actions">
              <button type="button" className="btn primary" onClick={openCurrent}>Open project</button>
              <button type="button" className="btn" onClick={() => setAll(true)}>All projects</button>
            </div>
            <p className="deck-meta">{counts(cur) || 'No media yet'}</p>
          </div>
          <p className="tagline pop" style={{ '--d': '.5s' }}>{tagline}</p>
        </div>

        <div className="deck-art" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {prev && <Art key={`out-${prev.id}`} p={prev} leaving />}
          <Art key={cur.id} p={cur} onOpen={openCurrent} />
        </div>
      </section>

      <nav className="rail pop" style={{ '--d': '.65s' }} aria-label="Projects" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <span className="rail-count" aria-hidden="true">{pad(safe + 1)}<i>/</i>{pad(n)}</span>
        <div className="strip" ref={stripRef}>
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`rc${i === safe ? ' on' : ''}`}
              data-pid={i === safe ? undefined : p.id}
              aria-current={i === safe}
              style={{ '--ph': p.cover?.color || 'var(--soft)' }}
              onClick={(e) => (i === safe ? openProject(p.id, e.currentTarget) : go(i))}
            >
              <span className="rc-img">
                {p.cover ? <Pic src={thumb(p.cover.file)} width={p.cover.w} height={p.cover.h} alt="" /> : <b>{p.name.charAt(0).toUpperCase()}</b>}
              </span>
              <span className="rc-t"><b>{p.name}</b><i>{year(p)}{counts(p) ? ` · ${counts(p)}` : ''}</i></span>
              {p.isNew && <span className="badge-new sm">New</span>}
              {i === safe && n > 1 && (
                <span className="rc-prog" aria-hidden="true">
                  <i
                    key={`${p.id}-${safe}`}
                    style={{ animationPlayState: hold ? 'paused' : 'running' }}
                    onAnimationEnd={(e) => { if (e.animationName === 'prog') go(safe + 1); }}
                  />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="rail-btns">
          <button type="button" className="round" onClick={() => go(safe - 1)} aria-label="Previous project">‹</button>
          <button type="button" className="round" onClick={() => go(safe + 1)} aria-label="Next project">›</button>
        </div>
      </nav>

      {all && (
        <AllPanel
          projects={projects}
          onClose={() => setAll(false)}
          onPick={(p, el) => openProject(p.id, el)}
        />
      )}

      {open && openProj && (
        <ProjectView
          key={open.id}
          project={openProj}
          company={company}
          origin={open.rect}
          closing={open.closing}
          onRequestClose={requestClose}
          onClosed={() => setOpen(null)}
        />
      )}
    </main>
  );
}
