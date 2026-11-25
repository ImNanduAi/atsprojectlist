// Runs in the browser: resizes a photo before upload so pages stay fast and files stay small.
const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

async function draw(bitmap, max) {
  const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * s)), h = Math.max(1, Math.round(bitmap.height * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return c;
}

function average(bitmap) {
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 8).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
}

/** Returns { big, thumb, ext, type, w, h, color } where big and thumb are Blobs. */
export async function processImage(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`${file.name} could not be read as a picture.`); }
  try {
    const bigC = await draw(bitmap, 1800);
    let type = 'image/webp', ext = 'webp';
    let big = await toBlob(bigC, type, 0.82);
    if (!big || big.type !== 'image/webp') { type = 'image/jpeg'; ext = 'jpg'; big = await toBlob(bigC, type, 0.85); }
    const thumbC = await draw(bitmap, 640);
    const thumb = await toBlob(thumbC, type, type === 'image/webp' ? 0.78 : 0.82);
    if (!big || !thumb) throw new Error(`${file.name} could not be converted.`);
    return { big, thumb, ext, type, w: bigC.width, h: bigC.height, color: average(bitmap) };
  } finally { bitmap.close?.(); }
}
