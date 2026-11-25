// Photos, videos and brochures live in Vercel Blob. A project stores the full web address of each file,
// and the small thumbnail of a photo is the same address with "_t" before the extension.
export const thumbName = (file) => file.replace(/\.(webp|jpg)$/, '_t.$1');
export const mediaUrl = (file) => file;
export const thumbUrl = (file) => thumbName(file);
/** Vercel Blob adds a "save as" header when ?download=1 is on the address. */
export const downloadUrl = (file) => `${file}?download=1`;
