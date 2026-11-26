import { guard } from '@/lib/auth';
import { fail, safe } from '@/lib/api';
import { updateData } from '@/lib/store';

export const runtime = 'nodejs';

// Saves the order the admin chose: the first id is shown first on the website.
export async function POST(request) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const b = await request.json().catch(() => ({}));
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    if (!ids.length || ids.length > 500 || ids.some((x) => !/^[a-f0-9]{12}$/.test(x))) return fail('Bad order.');
    await Promise.all(ids.map((id, i) => updateData(id, (d) => { d.order = i; return d; })));
    return Response.json({ ok: true });
  });
}
