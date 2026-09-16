import { put } from '@vercel/blob';

// SVG escluso di proposito: può contenere script
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

export class UploadError extends Error {}

export async function uploadTeamLogo(file: File) {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new UploadError('Logo must be a PNG, JPEG, WEBP or GIF image');
  }
  if (file.size > MAX_LOGO_SIZE) {
    throw new UploadError('Logo must be smaller than 2 MB');
  }

  // Il nome del file è generato dal server, non preso dall'utente
  const blob = await put(`logos/logo.${extension}`, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}
