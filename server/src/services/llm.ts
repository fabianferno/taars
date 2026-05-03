import { ethers } from 'ethers';
import { env } from '../env.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOpts {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  name: string; // 'zerog' | 'openai' | 'mock'
  complete(messages: ChatMessage[], opts?: CompleteOpts): Promise<string>;
}

// ----- 0G Compute provider -----

class ZeroGLLMProvider implements LLMProvider {
  name = 'zerog';
  private broker: any = null;
  private providerAddress: string | null = null;
  private serviceEndpoint: string | null = null;
  private model: string | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;

  private async initialize(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      // Lazy load — module init can be heavy.
      const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
      const provider = new ethers.JsonRpcProvider(env.OG_RPC_URL);
      const wallet = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
      this.broker = await createZGComputeNetworkBroker(wallet as any);

      const services = await this.broker.inference.listService();
      if (!services || services.length === 0) {
        throw new Error('No 0G Compute services available');
      }
      const chatServices = services.filter(
        (s: any) => s.serviceType === 'chatbot' || s.serviceType === 'chat'
      );
      if (chatServices.length === 0) throw new Error('No chatbot services on 0G Compute');

      // Ensure ledger exists / fund discovery (small amount: 0.05 OG).
      try {
        await this.broker.ledger.getLedger();
      } catch {
        console.log('[llm:0g] creating ledger and depositing funds');
        try {
          await this.broker.ledger.addLedger(0.05);
        } catch (e: any) {
          console.warn('[llm:0g] addLedger failed:', e?.message?.slice(0, 120));
        }
      }

      // Prefer the configured provider if matching, else first reachable.
      const preferred = env.OG_BROKER_PROVIDER;
      const ordered = preferred
        ? [
            ...chatServices.filter((s: any) => s.provider?.toLowerCase() === preferred.toLowerCase()),
            ...chatServices.filter((s: any) => s.provider?.toLowerCase() !== preferred.toLowerCase()),
          ]
        : chatServices;

      for (const svc of ordered) {
        try {
          await this.broker.inference.getAccount(svc.provider);
        } catch {
          try {
            await this.broker.ledger.transferFund(svc.provider, 'inference', 0.05);
          } catch {
            continue;
          }
        }
        try {
          await this.broker.inference.acknowledgeProviderSigner(svc.provider);
          this.providerAddress = svc.provider;
          this.serviceEndpoint = svc.url;
          this.model = svc.model;
          this.ready = true;
          console.log(`[llm:0g] connected to ${this.model} @ ${svc.provider}`);
          return;
        } catch (err: any) {
          console.warn(`[llm:0g] ${svc.model} unreachable: ${err?.message?.slice(0, 80)}`);
        }
      }
      throw new Error('All 0G Compute providers offline');
    })();
    try {
      await this.initPromise;
    } finally {
      // allow re-init on later calls if it failed
      if (!this.ready) this.initPromise = null;
    }
  }

  async complete(messages: ChatMessage[], opts?: CompleteOpts): Promise<string> {
    await this.initialize();
    if (!this.broker || !this.providerAddress || !this.serviceEndpoint) {
      throw new Error('0G provider not initialized');
    }
    const headers = await this.broker.inference.getRequestHeaders(this.providerAddress);
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 512,
    };
    const res = await fetch(`${this.serviceEndpoint}/v1/proxy/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`0G LLM request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('0G LLM returned no content');
    return content;
  }
}

// ----- OpenAI provider -----

class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: any = null;

  private async getClient() {
    if (this.client) return this.client;
    const mod: any = await import('openai');
    const OpenAI = mod.default ?? mod.OpenAI;
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    return this.client;
  }

  async complete(messages: ChatMessage[], opts?: CompleteOpts): Promise<string> {
    const client = await this.getClient();
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 512,
    });
    const content = res.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('OpenAI returned no content');
    return content;
  }
}

// ----- selector -----

export class LLMUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`No LLM provider available: ${reason}`);
    this.name = 'LLMUnavailableError';
  }
}

class ChainedLLMProvider implements LLMProvider {
  name = 'zerog+openai';
  private zerog: ZeroGLLMProvider | null;
  private openai: OpenAIProvider | null;
  lastUsed: string | null = null;
  lastError: string | null = null;

  constructor(zerog: ZeroGLLMProvider | null, openai: OpenAIProvider | null) {
    this.zerog = zerog;
    this.openai = openai;
  }

  async complete(messages: ChatMessage[], opts?: CompleteOpts): Promise<string> {
    if (this.zerog) {
      try {
        const out = await this.zerog.complete(messages, opts);
        this.lastUsed = 'zerog';
        this.lastError = null;
        return out;
      } catch (e) {
        this.lastError = (e as Error).message.slice(0, 200);
        console.warn('[llm] zerog failed:', this.lastError);
      }
    }
    if (this.openai) {
      try {
        const out = await this.openai.complete(messages, opts);
        this.lastUsed = 'openai';
        return out;
      } catch (e) {
        this.lastError = (e as Error).message.slice(0, 200);
        console.error('[llm] openai failed:', this.lastError);
      }
    }
    throw new LLMUnavailableError(this.lastError ?? 'no providers configured');
  }
}

let _provider: ChainedLLMProvider | null = null;

export function getLLM(): ChainedLLMProvider {
  if (_provider) return _provider;
  const zerog =
    env.OG_BROKER_PROVIDER && env.DEPLOYER_PRIVATE_KEY ? new ZeroGLLMProvider() : null;
  const openai = env.OPENAI_API_KEY ? new OpenAIProvider() : null;
  if (!zerog && !openai) {
    console.warn('[llm] no providers configured — /chat/message will return 503');
  } else {
    console.log(
      `[llm] providers ready: ${[zerog && 'zerog', openai && 'openai'].filter(Boolean).join(', ')}`
    );
  }
  _provider = new ChainedLLMProvider(zerog, openai);
  return _provider;
}

export function _resetLLM(): void {
  _provider = null;
}

export interface LLMStatus {
  zerog: { configured: boolean };
  openai: { configured: boolean };
  lastUsed: string | null;
  lastError: string | null;
}

export function getLLMStatus(): LLMStatus {
  const p = getLLM();
  return {
    zerog: { configured: Boolean(env.OG_BROKER_PROVIDER && env.DEPLOYER_PRIVATE_KEY) },
    openai: { configured: Boolean(env.OPENAI_API_KEY) },
    lastUsed: p.lastUsed,
    lastError: p.lastError,
  };
}
