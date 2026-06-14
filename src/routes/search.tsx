import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, Header } from "@/components/ada/AppShell";
import { SafeImage } from "@/components/ada/SafeImage";
import { CURATED_MOODBOARD, curatedMoodboardFor, useCart, useProfile } from "@/lib/ada-store";
import { ArrowRight, Link as LinkIcon, Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "ADA — Search" }] }),
  component: SearchPage,
});

const SUGGESTIONS = [
  "Jupe plissée",
  "Trench beige",
  "Mocassins en cuir",
];

function SearchPage() {
  const [q, setQ] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const { add } = useCart();
  const { profile } = useProfile();

  const inspirations = useMemo(() => {
    const curated = curatedMoodboardFor(profile.preferences || {});
    if (curated.length >= 3) return curated.slice(0, 4);
    // Fallback to a tasteful default fashion set (never landscapes).
    return CURATED_MOODBOARD.classic_elegant_mood.student_day.slice(0, 4);
  }, [profile.preferences?.style, profile.preferences?.budget, profile.preferences?.occasion]);

  const handleAddLink = () => {
    if (addingLink) return;
    setAddingLink(true);
    setTimeout(() => {
      try {
        add({
          name: "Article importé (Lien)",
          brand: "Lien externe",
          price: 0,
          originalPrice: 0,
          image: "https://picsum.photos/seed/ada-lien/200/200",
          source: "original",
        });
        setQ("");
        toast.success("Article ajouté au Super-Panier", { description: "En cours d'analyse…" });
      } finally {
        setAddingLink(false);
      }
    }, 1000);
  };

  return (
    <AppShell>
      <Header eyebrow="Discover" title="Effectuer une recherche ciblée." />

      <div className="px-6">
        <div className="flex items-center border border-border bg-cream p-1 focus-within:border-navy">
          <SearchIcon className="ml-3 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Décrivez un besoin (ex. « jupe »)…"
            className="flex-1 bg-transparent px-3 py-3 text-sm text-navy placeholder:text-muted-foreground outline-none"
          />
          <Link to="/analysis" search={{ q }} className="grid h-10 w-10 place-items-center bg-navy text-cream">
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
          

        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Suggestions</p>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  onClick={() => setQ(s)}
                  className="flex w-full items-center justify-between py-4 text-left text-sm text-navy transition hover:text-gold"
                >
                  <span>{s}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>

      
      </div>
    </AppShell>
  );
}
