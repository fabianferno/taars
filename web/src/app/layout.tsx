import ClientProviders from '@/providers';
import type { Metadata } from 'next';
import { Geist, Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const coolvetica = localFont({
  src: './fonts/CoolveticaRg.otf',
  variable: '--font-coolvetica',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://taars.crevn.xyz'),
  title: 'taars - Your AI Replica. Your Identity. Your Rules.',
  description:
    'Creator-owned AI replicas. Your voice, your ENS name, your INFT.',
  openGraph: {
    title: 'taars - Your AI Replica. Your Identity. Your Rules.',
    description:
      'Creator-owned AI replicas. Your voice, your ENS name, your INFT.',
    images: ['/site-banner.png'],
    type: 'website',
    siteName: 'taars',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'taars - Your AI Replica. Your Identity. Your Rules.',
    description:
      'Creator-owned AI replicas. Your voice, your ENS name, your INFT.',
    images: ['/site-banner.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} ${coolvetica.variable} font-inter`}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
