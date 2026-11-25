'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm({ defaultPassword }) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || 'Could not log in.');
    router.refresh();
  }
  return (
    <form className="panel login" onSubmit={submit}>
      <h2>Admin login</h2>
      <div>
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" className="field" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </div>
      {defaultPassword && <p className="hint">No ADMIN_PASSWORD is set, so the temporary password <b>admin123</b> works. Set ADMIN_PASSWORD in Vercel before sharing the site.</p>}
      <div className="actions">
        <button className="btn primary" disabled={busy}>Log in</button>
        <span className="msg err" role="status">{err}</span>
      </div>
    </form>
  );
}
