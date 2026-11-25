'use client';

import { useEffect, useRef } from 'react';

const hex = (h) => {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

/**
 * Living background: slow colour clouds, plus a network of drifting points that link up
 * with each other and reach towards the pointer. Colours follow the light/dark theme.
 */
export default function Ambient() {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, frame = 0, nodes = [];
    let A = [56, 182, 232], B = [230, 16, 138], dark = false;
    const mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4 };

    const readTheme = () => {
      const s = getComputedStyle(document.documentElement);
      const a = s.getPropertyValue('--amb-a').trim(), b = s.getPropertyValue('--amb-b').trim();
      if (a) A = hex(a);
      if (b) B = hex(b);
      dark = s.getPropertyValue('--amb-dark').trim() === '1';
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(95, Math.max(26, (w * h) / 15000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: 1.3 + Math.random() * 2, p: Math.random() * 6.28,
      }));
      readTheme();
      draw(0);
    };

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const maxD = Math.min(180, Math.max(115, w / 9));
      const lineA = dark ? 0.5 : 0.36, dotA = dark ? 0.9 : 0.65;
      mouse.x += (mouse.tx - mouse.x) * 0.14; mouse.y += (mouse.ty - mouse.y) * 0.14;

      for (const n of nodes) {
        if (!reduce) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 160 * 160) { const d = Math.sqrt(d2) || 1, f = (1 - d / 160) * 1.1; n.x += (dx / d) * f; n.y += (dy / d) * f; }
        }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > maxD * maxD) continue;
          const col = mix(A, B, Math.min(1, Math.max(0, (a.x + b.x) / 2 / w)));
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${((1 - Math.sqrt(d2) / maxD) * lineA).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        const mdx = a.x - mouse.x, mdy = a.y - mouse.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 200) {
          const col = mix(A, B, Math.min(1, Math.max(0, a.x / w)));
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${((1 - md / 200) * (lineA + 0.3)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (const n of nodes) {
        const col = mix(A, B, Math.min(1, Math.max(0, n.x / w)));
        const r = n.r * (1 + 0.35 * Math.sin(t * 0.002 + n.p));
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${dotA})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832); ctx.fill();
      }
    }

    const loop = (t) => {
      frame++;
      if (frame % 60 === 0) readTheme();
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!reduce && !raf) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());
    const onMove = (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; };
    const onLeave = () => { mouse.tx = -1e4; mouse.ty = -1e4; };
    const onTheme = () => { readTheme(); if (reduce) draw(0); };

    resize();
    start();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', onTheme);
    return () => {
      stop(); mo.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener?.('change', onTheme);
    };
  }, []);

  return (
    <div className="ambient" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <canvas ref={ref} />
    </div>
  );
}
