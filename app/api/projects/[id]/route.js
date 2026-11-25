import { guard } from '@/lib/auth';
import { fail, safe } from '@/lib/api';
import { cleanProjectInput, linkItems } from '@/lib/project-input';
import { getRow, updateData, deleteRow, removeFiles } from '@/lib/store';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const { id } = await params;
    const v = cleanProjectInput(await request.json().catch(() => ({})));
    if (v.error) return fail(v.error);
    const { links, ...fields } = v;
    const out = await updateData(id, (d) => {
      Object.assign(d, fields);
      d.media = [...(d.media || []).filter((m) => m.kind !== 'link'), ...linkItems(links)];
      return d;
    });
    if (!out) return fail('Project not found.', 404);
    return Response.json({ ok: true });
  });
}

export async function DELETE(request, { params }) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const { id } = await params;
    const row = await getRow(id);
    if (!row) return fail('Project not found.', 404);
    await deleteRow(id);
    await removeFiles(row.data?.media || []);
    return Response.json({ ok: true });
  });
}
