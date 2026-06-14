import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Header } from "@/components/ada/AppShell";
import { ArrowRight, Search as SearchIcon } from "lucide-react";

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
