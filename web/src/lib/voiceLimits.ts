/** Raw audio ceiling for /mint (JSON + base64 payload). ~4/3 larger over the wire. */
export const MAX_VOICE_BLOB_BYTES = 72 * 1024 * 1024;

export function voiceBlobTooLargeMessage(bytes: number): string {
  const mb = Math.round((MAX_VOICE_BLOB_BYTES / (1024 * 1024)) * 10) / 10;
  return `Voice sample is too large (${(bytes / (1024 * 1024)).toFixed(1)} MB, max ~${mb} MB). Use a shorter recording, upload a compressed file, or trim the audio and try again.`;
}
