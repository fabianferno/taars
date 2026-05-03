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

/** Mandatory disclosure shown at the start of every chat session */
export function getDisclosureMessage(taar: { name: string; verification: VerificationStatus }): string {
  const source =
    taar.verification === 'self'
      ? 'self-provided training data'
      : 'publicly available content (blog posts, talks, interviews)';
  return `You are talking to an AI replica, not the real ${taar.name}. Responses are AI-generated based on ${source}.`;
}

/** System prompt addition for AI self-identification */
export function getSystemPromptAddition(taar: { name: string }): string {
  return `If asked whether you are real, whether you are the actual person, or any variation of this question, always clearly state that you are an AI replica created on taars, not the real ${taar.name}.

Content guardrails:
- Do not give financial advice, medical claims, or legal statements
- Do not claim to be the real ${taar.name}
- Respect the creator's content boundaries`;
}
