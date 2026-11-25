import crypto from 'crypto';
import { unstable_cache, revalidateTag } from 'next/cache';
import { put, list, head, del } from '@vercel/blob';

/**
 * Everything is kept in Vercel Blob, so nothing is written to the web server's disk (Vercel's disk is
 * read-only) and no separate database is needed:
 *   data/projects/<id>.json   one small JSON file per project (its text and the list of its media)
 *   media/...                 the photos, videos and PDF brochures
 */
const DATA = 'data/projects/';
const dataPath = (id) => `${DATA}${id}.json`;
const TAG = 'projects';

export const configured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export const newId = (n = 12) => crypto.randomBytes(n).toString('hex');
export const isMediaId = (s) => /^[a-f0-9]{24}$/.test(String(s));

function needBlob() {
  if (!configured()) {
    throw new Error('File storage is not connected yet. In Vercel, open Storage, create a Blob store and connect it to this project (see README), then redeploy.');
  }
}

function cleanFeatures(a) {
  return Array.isArray(a) ? a.filter((f) => f && f.t).map((f) => ({ t: String(f.t), d: String(f.d || '') })) : [];
}

/** Turns a stored row into the project object the pages use. */
function shape(row) {
  const d = row.data || {};
  const items = (d.media || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const images = items.filter((m) => m.kind === 'image');
  return {
    id: row.id,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    name: d.name || '',
    details: d.details || '',
    tagline: d.tagline || '',
    client: d.client || '',
    category: d.category || '',
    features: cleanFeatures(d.features),
    images,
    videos: items.filter((m) => m.kind === 'video'),
    links: items.filter((m) => m.kind === 'link'),
    brochure: items.find((m) => m.kind === 'pdf') || null,
    cover: images[0] || null,
    isNew: Date.now() - Number(row.created_at) < 3 * 24 * 3600 * 1000,
  };
}

// Blob serves files through a cache, so the address carries the upload time: every save gets a fresh address.
const fetchRow = async (url, uploadedAt) => {
  const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}v=${new Date(uploadedAt).getTime()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Could not read a project (${r.status}).`);
  return r.json();
};

async function readAllRows() {
  needBlob();
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix: DATA, limit: 1000, cursor });
    blobs.push(...r.blobs.filter((b) => b.pathname.endsWith('.json')));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const rows = await Promise.all(blobs.map((b) => fetchRow(b.url, b.uploadedAt).catch((e) => { console.error(e); return null; })));
  return rows.filter(Boolean);
}

// The list is remembered between visits and refreshed whenever an admin saves something.
const cachedRows = unstable_cache(readAllRows, ['projects-rows'], { tags: [TAG], revalidate: 3600 });

export async function listProjects() {
  const rows = await cachedRows();
  return rows.map(shape).sort((a, b) => b.created_at - a.created_at);
}

export async function getProject(id) {
  const p = (await listProjects()).find((x) => x.id === String(id));
  return p || null;
}

/** The newest saved row ({ id, data, ... }) straight from storage, or null. For saving changes. */
export async function getRow(id) {
  needBlob();
  let meta;
  try { meta = await head(dataPath(String(id))); }
  catch (e) { if (/does not exist|not found/i.test(e?.message || '')) return null; throw e; }
  return fetchRow(meta.url, meta.uploadedAt);
}

async function writeRow(row) {
  await put(dataPath(row.id), JSON.stringify(row), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
  revalidateTag(TAG);
}

export async function insertProject(row) { needBlob(); await writeRow(row); }

/** Reads a project, lets `mutate` change its data, and saves it. Returns the new data, or null if there is no such project. */
export async function updateData(id, mutate) {
  const row = await getRow(id);
  if (!row) return null;
  const next = mutate(structuredClone(row.data || {}));
  await writeRow({ ...row, data: next, updated_at: Date.now() });
  return next;
}

export async function deleteRow(id) {
  needBlob();
  await del(dataPath(String(id)));
  revalidateTag(TAG);
}

/** Web addresses of the files that belong to a media item (a photo has a large and a small file). */
export function filesOf(m) {
  if (!m?.file || m.kind === 'link') return [];
  return m.kind === 'image' ? [m.file, m.file.replace(/\.(webp|jpg)$/, '_t.$1')] : [m.file];
}

export async function removeFiles(items) {
  const urls = items.flatMap(filesOf);
  if (!urls.length) return;
  try { await del(urls); } catch (e) { console.error('Could not remove files:', e.message); }
}
