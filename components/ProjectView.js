'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Pic from './Pic';
import { thumbUrl, mediaUrl, downloadUrl } from '@/lib/media-url';
import { counts, embedUrl, paragraphs } from '@/lib/format';

const thumb = thumbUrl;
const big = mediaUrl;
const OPEN = 'inset(0px 0px 0px 0px round 0px)';
const clipFrom = (r) =>
  `inset(${Math.max(0, r.top)}px ${Math.max(0, window.innerWidth - r.left - r.width)}px ${Math.max(0, window.innerHeight - r.top - r.height)}px ${Math.max(0, r.left)}px round 18px)`;

/** One photo on the stage, shown whole inside a frame on a blurred copy of itself (never cropped, never auto-zoomed). */
function Layer({ m, leaving, dir, zoom }) {
  return (
    <div className={`layer${leaving ? ' leaving' : ''}`} style={{ '--ph': m.color || '#1b1530', '--dir': dir }}>
      <img className="layer-bg" src={thumb(m.file)} alt="" aria-hidden="true" />
      <div className="layer-zoom" style={zoom && zoom.s !== 1 ? { transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})` } : undefined}>
        <Pic
          className="layer-img"
          src={big(m.file)}
          srcSet={`${thumb(m.file)} 640w, ${big(m.file)} 1800w`}
          sizes="100vw"
          width={m.w}
          height={m.h}
          alt=""
          decoding="async"
        />
      </div>
    </div>
  );
}

/**
 * Full-screen viewer for one project. Opens by growing out of the card that was clicked
 * (or fades in when there is no card), shows photos one at a time with animated changes,
 * and has a Videos tab. Used by the home page overlay and by the direct /projects/[id] page.
 */
export default function ProjectView({ project: p, company, origin, closing, onRequestClose, onClosed }) {
  const imgs = p.images;
  const vids = [
    ...p.videos.map((v) => ({ kind: 'file', id: v.id, file: v.file })),
    ...p.links.map((l) => ({ kind: 'link', id: l.id, url: l.url })),
  ];
  const [mode, setMode] = useState(imgs.length ? 'photos' : vids.length ? 'videos' : 'photos');
  const [view, setView] = useState({ cur: 0, dir: 1, leaving: null });
  const [infoOpen, setInfoOpen] = useState(true);
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  const [isFs, setIsFs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [settled, setSettled] = useState(false);
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef(null);
  const drag = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [clip, setClip] = useState(() => (origin && typeof window !== 'undefined' ? clipFrom(origin) : OPEN));
  const rootRef = useRef(null);
  const stripRef = useRef(null);
  const touch = useRef(null);
  const leaveTimer = useRef(null);
  const curRef = useRef(0);
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  // zoom: the photo is enlarged inside the screen; dragging moves it, it can never leave the screen
  const clampPan = useCallback((s, x, y) => {
    const img = stageRef.current?.querySelector('.layer:not(.leaving) .layer-img');
    const mx = Math.max(0, ((img?.offsetWidth || 0) * (s - 1)) / 2);
    const my = Math.max(0, ((img?.offsetHeight || 0) * (s - 1)) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  }, []);
  const zoomTo = useCallback((next) => {
    const s = Math.max(1, Math.min(5, next));
    const z = zoomRef.current;
    if (s === 1) { setZoom({ s: 1, x: 0, y: 0 }); return; }
    // enlarging hides the details sheet so the whole photo can be explored
    if (z.s === 1) setInfoOpen(false);
    const k = s / z.s;
    setZoom({ s, ...clampPan(s, z.x * k, z.y * k) });
  }, [clampPan]);
  const zoomIn = useCallback(() => zoomTo(zoomRef.current.s * 1.5), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(zoomRef.current.s / 1.5 < 1.05 ? 1 : zoomRef.current.s / 1.5), [zoomTo]);
  const zoomReset = useCallback(() => setZoom({ s: 1, x: 0, y: 0 }), []);
  const onWheel = (e) => { e.deltaY < 0 ? zoomIn() : zoomOut(); };
  const onDblClick = () => (zoomRef.current.s > 1 ? zoomReset() : zoomTo(2.5));
  const onPointerDown = (e) => {
    if (zoomRef.current.s <= 1 || e.button > 0 || e.target.closest('button')) return;
    drag.current = { px: e.clientX, py: e.clientY, x: zoomRef.current.x, y: zoomRef.current.y };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const z = zoomRef.current;
    setZoom({ s: z.s, ...clampPan(z.s, d.x + e.clientX - d.px, d.y + e.clientY - d.py) });
  };
  const endDrag = () => { drag.current = null; setDragging(false); };

  const show = useCallback((n, d) => {
    if (n === curRef.current) return;
    const from = curRef.current;
    curRef.current = n;
    setZoom({ s: 1, x: 0, y: 0 });
    setView({ cur: n, dir: d, leaving: { idx: from, dir: d } });
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setView((v) => ({ ...v, leaving: null })), 950);
  }, []);
  const go = useCallback((d) => {
    if (imgs.length < 2) return;
    show((curRef.current + d + imgs.length) % imgs.length, d);
  }, [imgs.length, show]);

  // the details sheet reveals slowly the first time (after the project has grown to full screen), faster afterwards
  useEffect(() => { const t = setTimeout(() => setSettled(true), 2400); return () => clearTimeout(t); }, []);

  // open: lock the page behind, size to the screen, grow out of the card
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    setVp({ w: window.innerWidth, h: window.innerHeight });
    setInfoOpen(window.innerWidth >= 760);
    let r1 = 0, r2 = 0;
    if (origin) r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setClip(OPEN)); });
    rootRef.current?.focus({ preventScroll: true });
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const onFs = () => setIsFs(!!document.fullscreenElement);
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      html.style.overflow = prevOverflow;
      cancelAnimationFrame(r1); cancelAnimationFrame(r2);
      clearTimeout(leaveTimer.current);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // close: shrink back into the card it came from, or fade if that card is not on screen
  useEffect(() => {
    if (!closing) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cards = [...document.querySelectorAll(`[data-pid="${p.id}"]`)].filter((e) => !rootRef.current?.contains(e));
    let rect = null;
    for (let i = cards.length - 1; i >= 0; i--) {
      const r = cards[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) { rect = r; break; }
    }
    let t;
    if (rect && !reduced) { setClip(clipFrom(rect)); t = setTimeout(() => onClosedRef.current?.(), 820); }
    else { setFadeOut(true); t = setTimeout(() => onClosedRef.current?.(), 420); }
    return () => clearTimeout(t);
  }, [closing, p.id]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onRequestClose?.();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'i' || e.key === 'I') setInfoOpen((o) => !o);
      else if (e.key === 'f' || e.key === 'F') toggleFs();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === '0') zoomReset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onRequestClose, zoomIn, zoomOut, zoomReset]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the chosen thumbnail in view
  useEffect(() => {
    const strip = stripRef.current, el = strip?.children[view.cur];
    if (el) strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
  }, [view.cur, mode]);

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }
  async function share() {
    const url = `${window.location.origin}/projects/${p.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  const onTouchStart = (e) => { touch.current = zoomRef.current.s > 1 || e.touches.length > 1 ? null : e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
  };

  const m = imgs[view.cur];
  const lv = view.leaving && imgs[view.leaving.idx];
  const paras = paragraphs(p.details);
  const words = p.name.split(/\s+/);
  const year = p.delivered || new Date(p.created_at).getFullYear();
  const feats = p.features || [];
  const meta = [['Client', p.client], ['Category', p.category], ['Delivered', String(year)], ['Media', counts(p)]].filter(([, v]) => v);
  const pdfName = `${p.name.replace(/[^\w\- ]+/g, '').trim() || 'project'} - brochure.pdf`;
  const pdfUrl = p.brochure ? big(p.brochure.file) : null;
  const pdfDownload = p.brochure ? downloadUrl(p.brochure.file, pdfName) : null;
  const kicker = [p.category || company, year].join(' · ');

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={p.name}
      className={`po${infoOpen ? ' det-open' : ''}${origin ? ' from-card' : ' from-fade'}${fadeOut ? ' fade-out' : ''}${closing ? ' closing' : ''}`}
      style={{ clipPath: clip, WebkitClipPath: clip }}
    >
      <span className="po-glow a" aria-hidden="true" />
      <span className="po-glow b" aria-hidden="true" />

      {mode === 'photos' && m && (
        <div ref={stageRef} className={`po-stage${zoom.s > 1 ? ' zoomed' : ''}${dragging ? ' dragging' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onWheel={onWheel} onDoubleClick={onDblClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {lv && <Layer key={`l-${view.leaving.idx}-${lv.id}`} m={lv} leaving dir={view.leaving.dir} />}
          <Layer key={m.id} m={m} dir={view.dir} zoom={zoom} />
        </div>
      )}
      {mode === 'photos' && !m && (
        <div className="po-empty" aria-hidden="true"><b>{p.name.charAt(0).toUpperCase()}</b></div>
      )}
      <div className="po-shade" />

      {mode === 'videos' && (
        <div className="po-videos">
          <div className="vgrid">
            {vids.map((v, i) => {
              const e = v.kind === 'link' ? embedUrl(v.url) : null;
              return (
                <div className="vcell" key={v.id} style={{ '--i': i }}>
                  {v.kind === 'file' ? (
                    <video controls preload="metadata" src={big(v.file)} />
                  ) : e ? (
                    <iframe className="embed" src={e} title="Project video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                  ) : (
                    <a className="linkrow" href={v.url} target="_blank" rel="noopener noreferrer">Watch video ↗ <span className="mono">{v.url.replace(/^https?:\/\//i, '').slice(0, 56)}</span></a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'photos' && m && (
        <div className="po-zoom" role="group" aria-label="Zoom photo">
          <button type="button" onClick={zoomIn} disabled={zoom.s >= 5} aria-label="Zoom in">+</button>
          <button type="button" className="pct" onClick={zoomReset} disabled={zoom.s === 1} aria-label="Reset zoom">{Math.round(zoom.s * 100)}%</button>
          <button type="button" onClick={zoomOut} disabled={zoom.s === 1} aria-label="Zoom out">−</button>
        </div>
      )}

      <div className="po-top">
        <div className="po-brand"><img src="/brand/ai-glyph.webp" alt="" width="400" height="428" /><span>{company}</span></div>
        {imgs.length > 0 && vids.length > 0 && (
          <div className="po-pills" role="group" aria-label="Media type">
            <button type="button" aria-pressed={mode === 'photos'} onClick={() => setMode('photos')}>Photos <b>{imgs.length}</b></button>
            <button type="button" aria-pressed={mode === 'videos'} onClick={() => setMode('videos')}>Videos <b>{vids.length}</b></button>
          </div>
        )}
        <div className="po-actions">
          {pdfUrl && <a className="po-btn" href={pdfDownload} download={pdfName}>Brochure ↓</a>}
          <button type="button" className="po-btn" onClick={share}>{copied ? 'Link copied' : 'Share'}</button>
          <button type="button" className="po-btn icon" onClick={toggleFs} aria-label={isFs ? 'Leave full screen' : 'Full screen'}>{isFs ? '⤡' : '⤢'}</button>
          <button type="button" className="po-btn icon close" onClick={onRequestClose} aria-label="Close project">×</button>
        </div>
      </div>

      {mode === 'photos' && imgs.length > 1 && (
        <>
          <button type="button" className="po-arrow prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
          <button type="button" className="po-arrow next" onClick={() => go(1)} aria-label="Next photo">›</button>
          <div className="po-strip" ref={stripRef}>
            {imgs.map((im, i) => (
              <button
                key={im.id}
                type="button"
                className="th"
                aria-label={`Photo ${i + 1} of ${imgs.length}`}
                aria-current={i === view.cur}
                style={{ '--i': i, '--ph': im.color || '#1b1530' }}
                onClick={() => show(i, i > curRef.current ? 1 : -1)}
              >
                <Pic src={thumb(im.file)} width={im.w} height={im.h} alt="" />
              </button>
            ))}
          </div>
          <span className="po-count">{view.cur + 1} / {imgs.length}</span>
        </>
      )}

      {!infoOpen && (
        <button type="button" className="po-bar" onClick={() => setInfoOpen(true)}>
          <span><small>{kicker}</small><b>{p.name}</b></span>
          <i>Details +</i>
        </button>
      )}

      <aside className={`po-det${infoOpen ? ' open' : ''}`} style={{ '--base': settled ? '.12s' : '1s' }} aria-label="Project details" aria-hidden={!infoOpen}>
        <div className="po-det-scroll">
          <div className="po-det-head">
            <p className="po-kicker rev" style={{ '--i': 0 }}>{kicker}</p>
            <button type="button" className="po-toggle" onClick={() => setInfoOpen(false)} aria-label="Hide details" tabIndex={infoOpen ? 0 : -1}>−</button>
          </div>

          <h2 className="po-det-title" style={{ '--wd': 'calc(var(--base) + .08s)' }}>
            {words.map((w, i) => <span className="w" key={i}><span style={{ '--i': i }}>{w}</span></span>)}
          </h2>

          {p.tagline && <p className="po-tagline rev" style={{ '--i': 3 }}>{p.tagline}</p>}

          {meta.length > 0 && (
            <dl className="po-meta">
              {meta.map(([k, v], i) => (
                <div className="rev" style={{ '--i': 4 + i }} key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}

          <div className="po-desc">
            {paras.length ? paras.map((t, i) => <p className="rev" style={{ '--i': 8 + i }} key={i}>{t}</p>) : <p className="rev dim" style={{ '--i': 8 }}>No details added yet.</p>}
          </div>

          {feats.length > 0 && (
            <section className="po-feats" aria-label="Key features">
              <h3 className="rev" style={{ '--i': 10 }}>Key features <span>{feats.length}</span></h3>
              <ol>
                {feats.map((f, i) => (
                  <li className="feat rev" style={{ '--i': 11 + i }} key={i}>
                    <span className="feat-n">{String(i + 1).padStart(2, '0')}</span>
                    <b>{f.t}</b>
                    {f.d && <p>{f.d}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {pdfUrl && (
            <div className="brochure rev" style={{ '--i': 12 + feats.length }}>
              <span className="brochure-ico" aria-hidden="true">PDF</span>
              <span className="brochure-t"><b>Project brochure</b><small>{p.brochure.name || 'Brochure.pdf'}</small></span>
              <span className="brochure-acts">
                <a className="brochure-go" href={pdfDownload} download={pdfName}>Download</a>
                <a className="brochure-alt" href={pdfUrl} target="_blank" rel="noopener noreferrer">Preview ↗</a>
              </span>
            </div>
          )}

          <p className="po-by rev" style={{ '--i': 13 + feats.length }}>Delivered by <b>{company}</b></p>
        </div>
      </aside>
    </div>
  );
}
