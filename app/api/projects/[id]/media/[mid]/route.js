import { guard } from '@/lib/auth';
import { fail, safe } from '@/lib/api';
import { updateData, removeFiles, isMediaId } from '@/lib/store';

export const runtime = 'nodejs';

export async function DELETE(request, { params }) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const { id, mid } = await params;
    let removed = null;
    const out = await updateData(id, (d) => {
      removed = (d.media || []).find((m) => m.id === mid) || null;
      d.media = (d.media || []).filter((m) => m.id !== mid);
      return d;
    });
    if (!out) return fail('Project not found.', 404);
    if (removed) await removeFiles([removed]);
    return Response.json({ ok: true });
  });
}

export async function PATCH(request, { params }) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const { id, mid } = await params;
    const b = await request.json().catch(() => ({}));
    if (!b.cover) return fail('Nothing to change.');
    let found = false;
    const out = await updateData(id, (d) => {
      const m = (d.media || []).find((x) => x.id === mid && x.kind === 'image');
      if (m) {
        found = true;
        m.position = Math.min(0, ...(d.media || []).map((x) => x.position ?? 0)) - 1;
      }
      return d;
    });
    if (!out) return fail('Project not found.', 404);
    if (!found) return fail('Photo not found.', 404);
    return Response.json({ ok: true });
  });
}
