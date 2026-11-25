import { guard } from '@/lib/auth';
import { fail, safe } from '@/lib/api';
import { cleanProjectInput, linkItems } from '@/lib/project-input';
import { insertProject, newId } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const b = await request.json().catch(() => ({}));
    const v = cleanProjectInput(b);
    if (v.error) return fail(v.error);
    const id = newId(6);
    const now = Date.now();
    const { links, ...fields } = v;
    await insertProject({ id, created_at: now, updated_at: now, data: { ...fields, media: linkItems(links) } });
    return Response.json({ id });
  });
}
