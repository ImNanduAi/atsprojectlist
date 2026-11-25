import { COMPANY, SHORT, TAGLINE } from '@/lib/brand';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-brand">
        <img src="/brand/ai-glyph.webp" alt="" width="400" height="428" className="foot-glyph" />
        <div>
          <strong>{COMPANY}</strong>
          <span className="tagline">{TAGLINE}</span>
        </div>
      </div>
      <div className="foot-meta">
        <span>{SHORT} project portfolio</span>
        <span>&copy; {new Date().getFullYear()} {COMPANY}</span>
      </div>
    </footer>
  );
}
