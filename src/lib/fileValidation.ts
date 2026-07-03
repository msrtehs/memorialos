export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function validateFile(
  file: File,
  allowedTypes = ALLOWED_DOCUMENT_TYPES
): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `Tipo de arquivo não permitido. Use: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB} MB (este arquivo: ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  }
  return null;
}
