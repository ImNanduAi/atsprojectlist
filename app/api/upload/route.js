import { handleUpload } from '@vercel/blob/client';
import { guard } from '@/lib/auth';
import { fail, safe } from '@/lib/api';
import { MAX_VIDEO, MAX_PDF, MAX_PROCESSED_IMAGE } from '@/lib/limits';

export const runtime = 'nodejs';

// Browsers send big files straight to Vercel Blob (a function can only accept ~4.5 MB). This route only
// hands out a short-lived permission, and only to a logged-in admin and only for files of the expected kind.
const RULES = [
  { re: /^media\/[a-f0-9]{24}(_t)?\.(webp|jpg)$/, types: ['image/webp', 'image/jpeg'], max: MAX_PROCESSED_IMAGE },
  { re: /^media\/[a-f0-9]{24}\.(mp4|webm|mov)$/, types: ['video/mp4', 'video/webm', 'video/quicktime'], max: MAX_VIDEO },
  { re: /^media\/[a-f0-9]{24}\/[A-Za-z0-9._-]{1,100}\.pdf$/, types: ['application/pdf'], max: MAX_PDF },
];

export async function POST(request) {
  return safe(async () => {
    const denied = await guard(request); if (denied) return denied;
    const body = await request.json().catch(() => null);
    if (!body) return fail('Bad request.');
    const json = await handleUpload({
      body, request,
      onBeforeGenerateToken: async (pathname) => {
        const rule = RULES.find((r) => r.re.test(pathname));
        if (!rule) throw new Error('This kind of file is not allowed.');
        return {
          allowedContentTypes: rule.types,
          maximumSizeInBytes: rule.max,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        };
      },
    });
    return Response.json(json);
  });
}
