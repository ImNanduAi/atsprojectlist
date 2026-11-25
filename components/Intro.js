'use client';

import { useEffect, useRef, useState } from 'react';

// Each piece of the logo starts off-screen in its own direction (x and y are % of the logo's size)
// and rotated, then flies in and snaps into place. `d` is the delay in seconds.
const PIECES = [
  { f: 'piece-4', x: '-95%', y: '55%', r: '-16deg', d: 0.05 },  // long cyan piece
  { f: 'piece-1', x: '75%', y: '-80%', r: '18deg', d: 0.25 },   // large blue-to-pink piece
  { f: 'piece-0', x: '-60%', y: '-95%', r: '-26deg', d: 0.45 },  // small top bar
  { f: 'piece-3', x: '95%', y: '75%', r: '-28deg', d: 0.65 },   // pink bar
  { f: 'piece-5', x: '12%', y: '110%', r: '22deg', d: 0.85 },   // bottom L
  { f: 'piece-2', x: '115%', y: '5%', r: '40deg', d: 1.05 },    // small pink block
];
const MIN_MS = 3400;   // the animation needs about this long to finish
const MAX_MS = 9000;   // never hold the visitor for longer than this

/**
 * Full-screen opening animation. It plays once per visit, waits until the page has
 * finished loading, then lifts away so the project list slides in.
 */
export default function Intro() {
  const [phase, setPhase] = useState('play'); // play | out | gone
  const finishRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro === 'skip') { setPhase('gone'); return; }

    root.dataset.introState = 'playing';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = [];
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      document.cookie = 'ats-intro=1; path=/; samesite=lax'; // lasts until the browser is closed
      root.dataset.introState = 'out';
      setPhase('out');
      timers.push(setTimeout(() => {
        root.dataset.intro = 'skip';
        delete root.dataset.introState;
        setPhase('gone');
      }, 1200));
    };
    finishRef.current = finish;

    const start = performance.now();
    const loaded = new Promise((res) => {
      if (document.readyState === 'complete') res();
      else window.addEventListener('load', res, { once: true });
    });
    const cap = new Promise((res) => timers.push(setTimeout(res, MAX_MS)));
    Promise.race([loaded, cap]).then(() => {
      const wait = Math.max(0, (reduce ? 700 : MIN_MS) - (performance.now() - start));
      timers.push(setTimeout(finish, wait));
    });

    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); timers.forEach(clearTimeout); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div className={`intro${phase === 'out' ? ' out' : ''}`} role="presentation">
      <noscript><style>{'.intro{display:none!important}'}</style></noscript>
      <span className="intro-glow g1" aria-hidden="true" />
      <span className="intro-glow g2" aria-hidden="true" />

      <div className="intro-stage">
        <div className="logo-stack" role="img" aria-label="Aatral AI Tech Solutions">
          {PIECES.map((p) => (
            <img
              key={p.f}
              className="piece"
              src={`/brand/intro/${p.f}.webp`}
              alt=""
              width="1100"
              height="1118"
              style={{ '--fx': p.x, '--fy': p.y, '--fr': p.r, '--d': `${p.d}s` }}
              fetchPriority="high"
              decoding="async"
            />
          ))}
          <img className="txt" src="/brand/intro/text-left.webp" alt="" width="1100" height="1118" style={{ '--d': '1.75s' }} decoding="async" />
          <img className="txt" src="/brand/intro/text-tag.webp" alt="" width="1100" height="1118" style={{ '--d': '2.1s' }} decoding="async" />
          <span className="shine" aria-hidden="true" />
        </div>

        <div className="intro-load" aria-live="polite">
          <span className="bar"><i /></span>
          <span className="intro-cap">Loading projects</span>
        </div>
      </div>

      <button type="button" className="intro-skip" onClick={() => finishRef.current?.()}>Skip intro →</button>
    </div>
  );
}
