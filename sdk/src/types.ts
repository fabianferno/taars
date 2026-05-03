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
    | 'ens.transfer'
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

export type AgentVerification = 'self' | 'community';

export interface AgentRecord {
  // From local hint (recorded at mint time):
  tokenId: string;             // decimal string
  ens: string;                 // e.g. "vitalik.taars.eth"
  ensLabel: string;            // e.g. "vitalik"
  mintedAt: number;            // unix seconds

  // From 0G chain:
  owner: string;               // current ownerOf(tokenId) on 0G

  // From ENS text records on Sepolia:
  pricePerMinUsd: string;      // raw string, e.g. "0.15" (or "0" if unset)
  description: string;
  avatar: string;              // url
  voiceId: string;
  storageRoot: string;
  // Derived UI bits (computed server-side from the above):
  name: string;                // defaults to capitalized ensLabel
  initials: string;            // first 2 chars of name uppercased
  gradient: string;            // deterministic gradient from ensLabel hash
  verification: AgentVerification;   // hackathon: always 'self' (real mint = self-verified)
  featured?: boolean;          // first 4 mints on landing
}
