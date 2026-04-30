export type VerificationStatus = 'self' | 'community';

export interface TaarData {
  name: string;
  ens: string;
  price: string;
  pricePerMin: number;
  bio: string;
  initials: string;
  gradient: string;
  category: string;
  rating: number;
  verification: VerificationStatus;
  /** Opening message reflecting the personality's domain expertise */
  greeting: string;
  /** Only set for community interpretations */
  disclaimer?: string;
  /** Optional photo from /public/models/ */
  image?: string;
}

export const FEATURED_TAARS: TaarData[] = [
  {
    name: 'Vitalik Buterin',
    ens: 'vitalik.taars.eth',
    price: '$0.15/min',
    pricePerMin: 0.15,
    bio: 'Ethereum co-founder. Decentralization maximalist.',
    initials: 'VB',
    gradient: 'from-indigo-500 to-purple-800',
    category: 'trending',
    rating: 5.0,
    verification: 'community',
    greeting: "Hey! Let's dive into Ethereum, decentralized governance, cryptography, or the future of public goods.",
    disclaimer: 'AI interpretation - not created or endorsed by Vitalik Buterin.',
  },
  {
    name: 'Donald Trump',
    ens: 'trump.taars.eth',
    price: '$0.05/min',
    pricePerMin: 0.05,
    bio: '45th President of the United States.',
    initials: 'DT',
    gradient: 'from-red-500 to-red-800',
    category: 'trending',
    rating: 4.2,
    verification: 'community',
    greeting: "Hey! Let's talk politics, deal-making, leadership, or the American economy.",
    disclaimer: 'AI interpretation - not created or endorsed by Donald Trump.',
  },
  {
    name: 'Fabian Ferno',
    ens: 'fabian.taars.eth',
    price: 'Free',
    pricePerMin: 0,
    bio: 'Builder and developer. Shipping fast.',
    initials: 'FF',
    gradient: 'from-emerald-500 to-teal-800',
    category: 'new',
    rating: 4.7,
    verification: 'self',
    greeting: "Hey! Let's talk about building products, shipping fast, or navigating the dev ecosystem.",
  },
  {
    name: 'Balaji Srinivasan',
    ens: 'balaji.taars.eth',
    price: '$0.10/min',
    pricePerMin: 0.10,
    bio: 'Author of The Network State. Futurist.',
    initials: 'BS',
    gradient: 'from-violet-500 to-fuchsia-800',
    category: 'top',
    rating: 4.8,
    verification: 'community',
    greeting: "Hey! Let's discuss the network state, techno-optimism, crypto geopolitics, or building sovereign communities.",
    disclaimer: 'AI interpretation - not created or endorsed by Balaji Srinivasan.',
  },
];

export const ALL_TAARS: TaarData[] = [
  ...FEATURED_TAARS,
  {
    name: 'Elon Musk',
    ens: 'elon.taars.eth',
    price: '$0.20/min',
    pricePerMin: 0.20,
    bio: 'CEO of Tesla and SpaceX. First-principles thinker.',
    initials: 'EM',
    gradient: 'from-sky-500 to-blue-800',
    category: 'trending',
    rating: 4.5,
    verification: 'community',
    greeting: "Hey! Let's talk rockets, EVs, Mars colonization, or first-principles engineering.",
    disclaimer: 'AI interpretation - not created or endorsed by Elon Musk.',
  },
  {
    name: 'Naval Ravikant',
    ens: 'naval.taars.eth',
    price: '$0.12/min',
    pricePerMin: 0.12,
    bio: 'AngelList co-founder. Wealth and happiness philosopher.',
    initials: 'NR',
    gradient: 'from-teal-500 to-cyan-800',
    category: 'top',
    rating: 4.9,
    verification: 'community',
    greeting: "Hey! Let's explore wealth creation, leverage, happiness, or angel investing.",
    disclaimer: 'AI interpretation - not created or endorsed by Naval Ravikant.',
  },
  {
    name: 'Satoshi Nakamoto',
    ens: 'satoshi.taars.eth',
    price: '$0.25/min',
    pricePerMin: 0.25,
    bio: 'Bitcoin creator. The mysterious origin.',
    initials: 'SN',
    gradient: 'from-yellow-600 to-amber-900',
    category: 'top',
    rating: 5.0,
    verification: 'community',
    greeting: "Hey! Let's discuss Bitcoin, peer-to-peer money, trustless systems, or the philosophy of decentralization.",
    disclaimer: 'AI interpretation - not created or endorsed by Satoshi Nakamoto.',
  },
];

export const TAAR_LOOKUP: Record<string, TaarData> = Object.fromEntries(
  ALL_TAARS.map((t) => [t.ens.replace('.taars.eth', ''), t])
);

/** Mandatory disclosure shown at the start of every chat session */
export function getDisclosureMessage(taar: TaarData): string {
  const source =
    taar.verification === 'self'
      ? 'self-provided training data'
      : 'publicly available content (blog posts, talks, interviews)';
  return `You are talking to an AI replica, not the real ${taar.name}. Responses are AI-generated based on ${source}.`;
}

/** System prompt addition for AI self-identification */
export function getSystemPromptAddition(taar: TaarData): string {
  return `If asked whether you are real, whether you are the actual person, or any variation of this question, always clearly state that you are an AI replica created on taars, not the real ${taar.name}.

Content guardrails:
- Do not give financial advice, medical claims, or legal statements
- Do not claim to be the real ${taar.name}
- Respect the creator's content boundaries`;
}
