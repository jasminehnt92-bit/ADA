import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useStyleVector, STYLE_VECTOR_DIMENSIONS, type StyleVector } from "@/lib/ada-store";

const LABELS: Record<keyof StyleVector, string> = {
  casual: "Casual / Décontracté",
  bold: "Bold / Affirmé",
  minimaliste: "Minimaliste",
  romantique: "Romantique",
  streetwear: "Streetwear",
  prix_sensibilite: "Sensible au prix",
  seconde_main_affinite: "Affinité seconde main",
  luxe_affinite: "Affinité luxe",
  sport: "Sport",
  vintage: "Vintage",
};

export function StyleVectorPanel() {
  const { vector } = useStyleVector();
  const isNeutral = STYLE_VECTOR_DIMENSIONS.every((key) => vector[key] >= 0.4 && vector[key] <= 0.6);
  const sorted = [...STYLE_VECTOR_DIMENSIONS].sort((a, b) => vector[b] - vector[a]);

  return (
    <section>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center border border-gold/40 bg-gold/10">
          <Sparkles className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Profil appris</p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Se met à jour à chaque interaction</p>

      {isNeutral ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Interagis avec ADA pour affiner ton profil.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {sorted.map((key) => {
            const pct = Math.round(vector[key] * 100);
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-navy">{LABELS[key]}</span>
                  <span className="font-serif text-sm text-navy">{pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-border">
                  <motion.div
                    className="h-full bg-navy"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
