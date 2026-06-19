import fs from 'node:fs';
import path from 'node:path';

// Uploaded images are stored on disk under <backend>/uploads and served at the
// /uploads route. imageUrls are stored as the relative path (e.g.
// "/uploads/abc.jpg"); the frontends resolve it against the backend origin.
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const UPLOADS_ROUTE = '/uploads';

export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
