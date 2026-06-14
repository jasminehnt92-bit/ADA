import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Header } from "@/components/ada/AppShell";
import {
  useProfile,
  useDashboardStats,
  PREFERENCE_LABELS,
  MEASUREMENT_FIELDS,
  clearConversation,
  type Profile,
  type MeasurementField,
} from "@/lib/ada-store";

type MeasurementKey = MeasurementField["key"];
import { Ruler } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "ADA — Profile" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, update } = useProfile();
  const stats = useDashboardStats();
  const navigate = useNavigate();
  const prefEntries = Object.entries(profile.preferences);

  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  useEffect(() => {
    setMeasurements(
      Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, profile[f.key]?.toString() ?? ""])),
    );
  }, [profile]);

  const saveMeasurement = (key: MeasurementKey, raw: string) => {
    const value = raw.trim() ? Number(raw) : undefined;
    update({ [key]: value } as Partial<Profile>);
  };

  const reset = () => {
    update({ name: "", email: "", age: undefined, sex: undefined, preferences: {}, onboarded: false });
    clearConversation();
    navigate({ to: "/onboarding" });
  };

  return (
    <AppShell>
      <Header eyebrow="Profile" title={profile.name || "Ton compte"} />

      <div className="px-6 space-y-6">
        {/* Identity */}
        <section className="border border-border bg-cream p-6">
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Identité</p>
          <div className="mt-4 space-y-3">
            <InfoRow label="Email" value={profile.email || "—"} />
            {profile.age && <InfoRow label="Âge" value={`${profile.age} ans`} />}
            {profile.sex && <InfoRow label="Genre" value={profile.sex} />}
          </div>
        </section>

        {/* Lifetime savings */}
        <section className="border border-border bg-navy p-6 text-cream">
          <p className="text-[10px] uppercase tracking-[0.32em] text-cream/70">Économies totales</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-5xl text-cream">+{Math.round(stats.totalSavings)}</span>
            <span className="font-serif text-2xl text-gold">€</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-cream/15 pt-4 text-center text-cream/80">
            <MiniStat label="Neufs" value={stats.waitedCount} />
            <MiniStat label="Vinted" value={stats.swappedCount} />
            <MiniStat label="Outlet" value={stats.outletCount} />
          </div>
        </section>

        {/* Taste profile */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Profile de goût</p>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {prefEntries.length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">Aucune préférence encore.</li>
            )}
            {prefEntries.map(([k, v]) => {
              const labels = PREFERENCE_LABELS[k];
              const displayValue = labels ? (v === "left" ? labels.left : labels.right) : v === "left" ? "Option A" : "Option B";
              return (
                <li key={k} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <span className="capitalize text-navy">{k.replaceAll("_", " ")}</span>
                  <span className="text-right text-[10px] uppercase tracking-[0.2em] text-gold">{displayValue}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Measurements */}
        <section>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-gold/40 bg-gold/10">
              <Ruler className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
            </div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Mensurations</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Facultatif — utilisé pour t'aider à choisir la bonne taille. Modifie ou complète à tout moment.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-7">
            {MEASUREMENT_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{f.label}</span>
                <div className="mt-2 flex items-baseline border-0 border-b border-border pb-2 focus-within:border-navy">
                  <input
                    type="number"
                    min="0"
                    max="250"
                    inputMode="numeric"
                    value={measurements[f.key] ?? ""}
                    onChange={(e) => setMeasurements({ ...measurements, [f.key]: e.target.value })}
                    onBlur={(e) => saveMeasurement(f.key, e.target.value)}
                    className="w-full border-0 bg-transparent font-serif text-xl text-navy outline-none"
                    placeholder={f.placeholder}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">cm</span>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{f.hint}</p>
              </label>
            ))}
          </div>
        </section>

        <button
          onClick={reset}
          className="w-full border border-border bg-cream py-4 text-[11px] uppercase tracking-[0.32em] text-navy transition hover:border-navy"
        >
          Refaire l'onboarding
        </button>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="font-serif text-base text-navy">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-serif text-xl text-cream">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-cream/60">{label}</p>
    </div>
  );
}
