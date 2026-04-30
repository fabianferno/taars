import { env } from '../env.js';

export interface VoiceProfile {
  voiceId: string;
  provider: 'openvoice';
  sampleRate: number;
}

/// Train a voice profile from a single mic sample by uploading to the
/// local OpenVoice service. Returns a stable voiceId equal to the ENS label.
/// In the demo narrative this represents what 0G Compute (TEE fine-tune) does
/// in production.
export async function trainVoiceProfile(
  voiceId: string,
  sampleBytes: Uint8Array,
  sampleMime: string
): Promise<VoiceProfile> {
  const form = new FormData();
  form.append('voice_id', voiceId);
  form.append(
    'sample',
    new Blob([sampleBytes as BlobPart], { type: sampleMime }),
    `${voiceId}.${sampleMime.includes('webm') ? 'webm' : 'wav'}`
  );

  const res = await fetch(`${env.OPENVOICE_URL}/clone`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    throw new Error(`OpenVoice /clone failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { voice_id: string; sample_rate: number };
  return { voiceId: json.voice_id, provider: 'openvoice', sampleRate: json.sample_rate };
}

export async function synthesize(voiceId: string, text: string, speed = 1.0): Promise<Buffer> {
  const res = await fetch(`${env.OPENVOICE_URL}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: voiceId, text, speed }),
  });
  if (!res.ok) {
    throw new Error(`OpenVoice /synthesize failed: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
