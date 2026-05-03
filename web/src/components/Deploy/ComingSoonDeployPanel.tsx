'use client';
import Image from 'next/image';
import { Lock, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';

interface ComingSoonDeployPanelProps {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: 'sky' | 'emerald' | 'green' | 'slate' | 'rose';
}

const ACCENTS = {
  sky: {
    border: 'border-sky-200/70',
    bg: 'from-sky-50 to-white',
    iconBg: 'bg-sky-500/15',
    badge: 'bg-sky-100 text-sky-700',
  },
  emerald: {
    border: 'border-emerald-200/70',
    bg: 'from-emerald-50 to-white',
    iconBg: 'bg-emerald-500/15',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  green: {
    border: 'border-green-200/70',
    bg: 'from-green-50 to-white',
    iconBg: 'bg-green-500/15',
    badge: 'bg-green-100 text-green-700',
  },
  slate: {
    border: 'border-slate-200/70',
    bg: 'from-slate-50 to-white',
    iconBg: 'bg-slate-500/15',
    badge: 'bg-slate-100 text-slate-700',
  },
  rose: {
    border: 'border-rose-200/70',
    bg: 'from-rose-50 to-white',
    iconBg: 'bg-rose-500/15',
    badge: 'bg-rose-100 text-rose-700',
  },
};

export function ComingSoonDeployPanel({
  title,
  description,
  icon,
  accent = 'slate',
}: ComingSoonDeployPanelProps) {
  const a = ACCENTS[accent];
  return (
    <section
      className={`mt-3 rounded-2xl border ${a.border} bg-gradient-to-br ${a.bg} p-4 shadow-sm opacity-80`}
      aria-disabled
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${a.iconBg} overflow-hidden`}
          >
            {icon}
          </div>
          <div>
            <h2 className="font-coolvetica text-lg text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full ${a.badge} px-2 py-0.5 text-[10px] font-medium`}
          >
            <Lock className="h-3 w-3" />
            coming soon
          </span>
        </div>
      </div>
    </section>
  );
}

export function TelegramComingSoon() {
  return (
    <ComingSoonDeployPanel
      title="Deploy to Telegram"
      description="Add the taar to a Telegram group or channel · live billing via x402"
      accent="sky"
      icon={
        <Image
          src="/tg-icon.png"
          alt="Telegram"
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
        />
      }
    />
  );
}

export function WhatsAppComingSoon() {
  return (
    <ComingSoonDeployPanel
      title="Deploy to WhatsApp"
      description="Chat with the taar over WhatsApp · pay per minute"
      accent="green"
      icon={
        <Image
          src="/whatsapp-icon.webp"
          alt="WhatsApp"
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
        />
      }
    />
  );
}

export function PhoneCallComingSoon() {
  return (
    <ComingSoonDeployPanel
      title="Deploy to Phone Call"
      description="Get a real phone number that rings the taar · pay per minute"
      accent="emerald"
      icon={
        <Image
          src="/phone-app-icon.svg"
          alt="Phone"
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
        />
      }
    />
  );
}

export function SlackComingSoon() {
  return (
    <ComingSoonDeployPanel
      title="Deploy to Slack"
      description="Bring the taar into your Slack workspace · pay per minute"
      accent="rose"
      icon={<MessageCircle className="h-5 w-5 text-rose-600" />}
    />
  );
}
