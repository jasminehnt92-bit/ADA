import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BottomNav } from "./BottomNav";
import { useProfile } from "@/lib/ada-store";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, ready } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !profile.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [ready, profile.onboarded, navigate]);

  return (
    <div className="min-h-screen bg-cream text-navy">
      <div className="mx-auto max-w-md">
        <nav className="flex items-center px-6 pt-5 pb-1">
          <Link to="/" aria-label="ADA — Accueil">
            <img src="/logo.jpeg" alt="ADA" className="h-12 w-auto object-contain" />
          </Link>
        </nav>
        <div className="pb-24">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}

export function Header({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <header className="px-6 pt-6 pb-6">
      {eyebrow && (
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">{eyebrow}</p>
      )}
      <h1 className="font-serif text-4xl leading-tight text-navy">{title}</h1>
      <div className="mt-4 h-px w-12 bg-gold" />
    </header>
  );
}
