export type EnsLabel = string;

export interface PersonalityAnswers {
  vibe: string;
  expertise: string;
  catchphrases: string;
  avoid: string;
  example1Q: string;
  example1A: string;
  example2Q: string;
  example2A: string;
  example3Q: string;
  example3A: string;
}

export interface MintRequest {
  ensLabel: string;
  ownerAddress: `0x${string}`;
  voiceSampleBase64: string;
  voiceSampleMime: string;
  personality: PersonalityAnswers;
  pricePerMinUsd: string;
  description?: string;
  avatarUrl?: string;
}

export interface IntelligentDataEntry {
  dataDescription: string;
  dataHash: `0x${string}`;
  storageRoot: string;
}

export interface MintResponse {
  ok: true;
  tokenId: string;
  storageRoot: string;
  intelligentData: IntelligentDataEntry[];
  ensLabel: string;
  ensFullName: string;
  voiceProfileId: string;
  txInft: string;
  txEnsSubname: string;
  txEnsTextRecords: string[];
}

export interface MintErrorResponse {
  ok: false;
  step:
    | 'voice'
    | 'encrypt'
    | 'storage'
    | 'inft'
    | 'ens.subname'
    | 'ens.records'
    | 'unknown';
  error: string;
}

export interface ReplicaTextRecords {
  'taars.inft'?: string;
  'taars.storage'?: string;
  'taars.created'?: string;
  'taars.version'?: string;
  'taars.price'?: string;
  'taars.currency'?: string;
  'taars.network'?: string;
  'taars.voice'?: string;
  avatar?: string;
  description?: string;
  url?: string;
}

export const TAARS_TEXT_KEYS = [
  'taars.inft',
  'taars.storage',
  'taars.created',
  'taars.version',
  'taars.price',
  'taars.currency',
  'taars.network',
  'taars.voice',
  'avatar',
  'description',
  'url',
] as const;
