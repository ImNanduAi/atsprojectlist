// Shared by the browser (checks before uploading) and the server (checks what it will accept).
export const MAX_VIDEO = 300 * 1024 * 1024; // video files
export const MAX_PDF = 50 * 1024 * 1024;    // PDF brochures
export const MAX_IMAGE = 25 * 1024 * 1024;  // photos before they are resized in the browser
export const MAX_PROCESSED_IMAGE = 8 * 1024 * 1024; // what the browser actually uploads
export const MULTIPART_FROM = 40 * 1024 * 1024;     // bigger files are sent in parts
