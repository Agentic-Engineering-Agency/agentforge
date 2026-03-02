export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/zip",
  "application/gzip",
  "text/javascript",
  "text/typescript",
  "text/html",
  "text/css",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function validateFileUpload(args: {
  mimeType: string;
  size: number;
}): { valid: boolean; error?: string } {
  if (args.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  // Allow all MIME types but warn on uncommon ones
  return { valid: true };
}
