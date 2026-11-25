'use client';

export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    document.cookie = `ats-theme=${next}; path=/; max-age=31536000; samesite=lax`; // remembered as a small cookie
  }
  return (
    <button type="button" className="theme-btn" onClick={toggle} aria-label="Switch between light and dark theme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
      </svg>
    </button>
  );
}
