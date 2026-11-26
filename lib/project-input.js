import { newId } from './store';

/** Checks what the admin form sent. Returns { error } or the cleaned fields. */
export function cleanProjectInput(b) {
  const name = String(b.name || '').trim();
  if (!name) return { error: 'Enter a project name.' };
  if (name.length > 120) return { error: 'The project name is too long (120 characters max).' };
  const details = String(b.details || '').trim();
  if (details.length > 8000) return { error: 'The details are too long (8000 characters max).' };
  const tagline = String(b.tagline || '').trim();
  const client = String(b.client || '').trim();
  const category = String(b.category || '').trim();
  const delivered = String(b.delivered || '').trim();
  if (delivered.length > 40) return { error: 'The delivered date is too long (40 characters max).' };
  if (tagline.length > 160) return { error: 'The headline is too long (160 characters max).' };
  if (client.length > 120) return { error: 'The client name is too long (120 characters max).' };
  if (category.length > 80) return { error: 'The category is too long (80 characters max).' };
  const features = (Array.isArray(b.features) ? b.features : [])
    .map((f) => ({ t: String(f?.t || '').trim(), d: String(f?.d || '').trim() }))
    .filter((f) => f.t);
  if (features.length > 12) return { error: 'Add up to 12 key features.' };
  if (features.some((f) => f.t.length > 80 || f.d.length > 400)) return { error: 'A key feature is too long (title 80, description 400 characters max).' };
  const links = (Array.isArray(b.links) ? b.links : []).map((u) => String(u).trim()).filter(Boolean);
  if (links.length > 20) return { error: 'Add up to 20 video links.' };
  if (links.some((u) => !/^https?:\/\/\S+$/i.test(u) || u.length > 500)) return { error: 'A video link is not a valid web address.' };
  return { name, details, tagline, client, category, delivered, features, links };
}

/** Video links are stored with the project's other media. */
export function linkItems(links) {
  return links.map((url, i) => ({ id: newId(), kind: 'link', url, position: 1000 + i, created_at: Date.now() }));
}
