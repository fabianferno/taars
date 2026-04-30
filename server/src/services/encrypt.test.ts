import { describe, it, expect } from 'vitest';
import { encryptBlob, decryptBlob, blobToBytes } from './encrypt.js';

const KEY = 'a'.repeat(64);

describe('encrypt', () => {
  it('roundtrips utf-8', () => {
    const cipher = encryptBlob('hello taars', KEY);
    const plain = decryptBlob(cipher, KEY);
    expect(plain.toString('utf8')).toBe('hello taars');
  });

  it('produces fresh IV each call', () => {
    const a = encryptBlob('repeat', KEY);
    const b = encryptBlob('repeat', KEY);
    expect(a.iv).not.toBe(b.iv);
  });

  it('blobToBytes serializes to JSON utf-8 bytes', () => {
    const cipher = encryptBlob('x', KEY);
    const bytes = blobToBytes(cipher);
    const parsed = JSON.parse(bytes.toString('utf8'));
    expect(parsed.iv).toBe(cipher.iv);
    expect(parsed.ciphertext).toBe(cipher.ciphertext);
    expect(parsed.authTag).toBe(cipher.authTag);
  });

  it('rejects key of wrong length', () => {
    expect(() => encryptBlob('x', 'ab')).toThrow();
  });

  it('decrypt with wrong key fails', () => {
    const cipher = encryptBlob('hello', KEY);
    const otherKey = 'b'.repeat(64);
    expect(() => decryptBlob(cipher, otherKey)).toThrow();
  });
});
