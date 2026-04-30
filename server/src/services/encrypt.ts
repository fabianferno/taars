import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
  authTag: string;
}

function hexKey(hex: string): Buffer {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return buf;
}

export function encryptBlob(plaintext: Buffer | string, hexKey32: string): EncryptedBlob {
  const key = hexKey(hexKey32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

export function decryptBlob(blob: EncryptedBlob, hexKey32: string): Buffer {
  const key = hexKey(hexKey32);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'hex')),
    decipher.final(),
  ]);
}

export function blobToBytes(blob: EncryptedBlob): Buffer {
  return Buffer.from(JSON.stringify(blob), 'utf8');
}
