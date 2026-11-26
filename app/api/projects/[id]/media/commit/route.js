import { head } from '@vercel/blob';
import { guard } from '@/lib/auth';
import { fail, safe } from '@/lib/api';
import { token, updateData, isMediaId, removeFiles } from '@/lib/store';

export const runtime = 'nodejs';

function hostOk(u) {
  try {
    const x = new URL(u);
    if (x.host.endsWith('.blob.vercel-storage.com')) return x.protocol === 'https:';
    const api = process.env.VERCEL_BLOB_API_URL;
    return !!api && x.origin === new URL(api).origin;
  } catch { return false; }
}
const pathOf = (u) => decodeURIComponent(new URL(u).pathname.replace(/^\//, ''));

// Called by the browser after its files reached Blob: checks them and adds them to the project.
export async function POST(request, { params }) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const { id } = await params;
    const b = await request.json().catch(() => ({}));
    const kind = b.kind;
    if (!['image', 'video', 'pdf'].includes(kind)) return fail('Unknown media type.');
    const file = String(b.file || '');
    if (!hostOk(file)) return fail('Unexpected file address.');
    const p = pathOf(file);
    const re = {
      image: /^media\/([a-f0-9]{24})\.(webp|jpg)$/,
      video: /^media\/([a-f0-9]{24})\.(mp4|webm|mov)$/,
      pdf: /^media\/([a-f0-9]{24})\/[A-Za-z0-9._-]{1,100}\.pdf$/,
    }[kind];
    const m = p.match(re);
    if (!m || !isMediaId(m[1])) return fail('Unexpected file name.');
    await head(file, { token: token() }); // throws when the file is not really there
    if (kind === 'image') await head(file.replace(/\.(webp|jpg)$/, '_t.$1'), { token: token() });

    const item = {
      id: m[1], kind, file,
      name: String(b.name || '').slice(0, 200) || null,
      size: Number(b.size) || 0,
      position: Date.now() % 1e9,
      created_at: Date.now(),
    };
    if (kind === 'image') {
      item.w = Number(b.w) || 0; item.h = Number(b.h) || 0;
      item.color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#1b2236';
    }
    let old = [];
    const out = await updateData(id, (d) => {
      d.media = d.media || [];
      if (kind === 'pdf') { old = d.media.filter((x) => x.kind === 'pdf'); d.media = d.media.filter((x) => x.kind !== 'pdf'); }
      if (!d.media.some((x) => x.id === item.id)) d.media.push(item);
      return d;
    });
    if (!out) { await removeFiles([item]); return fail('Project not found.', 404); }
    if (old.length) await removeFiles(old);
    return Response.json({ ok: true, id: item.id });
  });
}
