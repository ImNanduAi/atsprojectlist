export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
export function fmtYear(ts) {
  return ts ? String(new Date(ts).getFullYear()) : '';
}
export function counts(p) {
  const i = p.images.length, v = p.videos.length + p.links.length;
  const out = [];
  if (i) out.push(`${i} ${i === 1 ? 'photo' : 'photos'}`);
  if (v) out.push(`${v} ${v === 1 ? 'video' : 'videos'}`);
  return out.join(' · ');
}
export function paragraphs(t) {
  return String(t || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}
export { thumbUrl as thumbSrc, mediaUrl as fullSrc } from './media-url';

/** YouTube and Vimeo links become embeddable players; anything else returns null. */
export function embedUrl(u) {
  try {
    const x = new URL(u);
    const h = x.hostname.replace(/^www\./, '');
    let id = null;
    if (h === 'youtu.be') id = x.pathname.slice(1);
    else if (h === 'youtube.com' || h === 'm.youtube.com') {
      if (x.pathname === '/watch') id = x.searchParams.get('v');
      else if (/^\/(shorts|embed)\//.test(x.pathname)) id = x.pathname.split('/')[2];
    }
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (h === 'vimeo.com') {
      const m = x.pathname.match(/^\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch { /* not a URL */ }
  return null;
}
