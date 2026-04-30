import type { MintRequest, MintResponse, MintErrorResponse } from '@taars/sdk';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:8080';

export async function mintReplica(req: MintRequest): Promise<MintResponse> {
  const res = await fetch(`${SERVER_URL}/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let err: MintErrorResponse | { error?: string } = {};
    try {
      err = await res.json();
    } catch {
      // not JSON
    }
    const msg =
      'step' in err && 'error' in err
        ? `mint failed at ${err.step}: ${err.error}`
        : `mint failed: ${res.status} ${(err as { error?: string }).error ?? res.statusText}`;
    throw new Error(msg);
  }
  return res.json();
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}
