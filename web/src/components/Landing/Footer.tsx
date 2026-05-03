"use client";

import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-surface-dark/60 bg-surface py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/taars-logo.jpg"
              alt="Taars"
              width={24}
              height={24}
              className="rounded-sm"
            />
            <span className="font-coolvetica text-lg text-foreground">
              taars
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="#featured"
              className="hover:text-foreground transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/create"
              className="hover:text-foreground transition-colors"
            >
              Create
            </Link>
            <Link
              href="#"
              className="hover:text-foreground transition-colors"
            >
              About
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-surface-dark/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground/60 font-mono uppercase tracking-wider">
              Powered by
            </span>
            <div className="flex items-center gap-3">
              <Image
                src="/0g-logo.png"
                alt="0G"
                width={20}
                height={20}
                className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/ens-logo.jpeg"
                alt="ENS"
                width={20}
                height={20}
                className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              />
              <Image
                src="/keeperhub-logo.png"
                alt="KeeperHub"
                width={20}
                height={20}
                className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} taars. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
