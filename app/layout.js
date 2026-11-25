import '@fontsource-variable/montserrat';
import '@fontsource-variable/figtree';
import './globals.css';
import Link from 'next/link';
import { COMPANY, SHORT, TAGLINE } from '@/lib/brand';
import ThemeToggle from '@/components/ThemeToggle';
import Ambient from '@/components/Ambient';

export const metadata = {
  title: { default: `Our Projects | ${COMPANY}`, template: `%s | ${COMPANY}` },
  description: `Projects delivered by ${COMPANY} (${SHORT}). ${TAGLINE}.`,
};

// Runs before the first paint: remembers the theme, and decides whether the opening
// animation should play (once per visit, on the home page, not when a project link is opened).
const startScript = `try{var d=document.documentElement,t=(document.cookie.match(/(?:^|; )ats-theme=(dark|light)/)||[])[1];if(t)d.dataset.theme=t}catch(e){}
try{var s=/(?:^|; )ats-intro=1/.test(document.cookie),h=location.hash.indexOf('#p-')===0;if(s||h){document.documentElement.dataset.intro='skip'}else if(location.pathname==='/'){document.documentElement.dataset.introState='playing'}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: startScript }} />
        <noscript>
          <style>{'.intro{display:none!important}.pop,.w>span{animation:none!important}.pic{opacity:1!important;filter:none!important;transform:none!important}'}</style>
        </noscript>
      </head>
      <body>
        <Ambient />
        <header className="top">
          <div className="top-in">
            <Link href="/" className="brand" aria-label={`${COMPANY} home`}>
              <img src="/brand/wordmark.webp" alt={COMPANY} width="1400" height="108" className="wordmark" />
            </Link>
            <nav className="nav" aria-label="Main">
              <Link href="/">Projects</Link>
              <Link href="/admin">Admin</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
