import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Header } from "@/components/ada/AppShell";
import { SafeImage } from "@/components/ada/SafeImage";
import { useCart, useProfile, imageForCategory } from "@/lib/ada-store";
import { searchProducts, analyzeProductLink, type SearchResult } from "@/lib/api/ada.functions";
import { Check, Clock, Loader2, Sparkles, Tag, MessageCircle } from "lucide-react";

const searchSchema = z.object({ q: z.string().optional(), url: z.string().optional() });

export const Route = createFileRoute("/analysis")({
  head: () => ({ meta: [{ title: "ADA — Analyse" }] }),
  validateSearch: searchSchema,
  component: Analysis,
});

function Analysis() {
  const { q, url } = useSearch({ from: "/analysis" });
  const { profile, ready } = useProfile();
  const { add } = useCart();

  const minimalProfile = {
    name: profile.name,
    age: profile.age,
    sex: profile.sex,
    preferences: profile.preferences,
  };

  // Link mode (url) → real scrape + Vinted + price model, NO LLM (no profile needed).
  // Text mode (q)  → LLM search, needs the profile loaded.
  const isLink = !!url;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: isLink ? ["analyze-link", url] : ["search", q, ready],
    queryFn: () =>
      isLink
        ? analyzeProductLink({ data: { url: url! } })
        : searchProducts({ data: { query: q!, profile: minimalProfile } }),
    enabled: isLink ? !!url : !!q && ready,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const hasInput = isLink || !!q;
  const waitingProfile = !isLink && !ready;

  return (
    <AppShell>
      <Header eyebrow="Analyse considered" title="Trois chemins vers cette pièce." />

      {!hasInput ? (
        <NoQueryView />
      ) : isLoading || waitingProfile ? (
        <LoadingView query={url ? "ton article" : q!} />
      ) : isError ? (
        <ErrorView query={url ? "ton article" : q!} error={error} />
      ) : data ? (
        <ResultView result={data} onAdd={add} />
      ) : null}
    </AppShell>
  );
}

function NoQueryView() {
  return (
    <div className="px-6">
      <div className="border border-border bg-cream p-8 text-center">
        <p className="font-serif text-lg text-navy">Aucune recherche en cours.</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Utilise la conversation avec ADA pour cibler ce que tu cherches.
        </p>
        <Link
          to="/chat"
          className="mt-6 inline-flex items-center gap-2 bg-navy px-5 py-3 text-[11px] uppercase tracking-[0.28em] text-cream transition hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          Parler à ADA
        </Link>
      </div>
    </div>
  );
}

function LoadingView({ query }: { query: string }) {
  return (
    <div className="px-6">
      <p className="text-xs text-muted-foreground">
        Recherche : <span className="text-navy">« {query} »</span>
      </p>
      <div className="mt-6 flex flex-col items-center border border-border bg-cream p-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
        <p className="mt-5 font-serif text-lg leading-snug text-navy">ADA analyse…</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Je scanne marques, Vinted et déstockages pour trouver le meilleur rapport qualité/prix.
        </p>
      </div>
    </div>
  );
}

function ErrorView({ query, error }: { query: string; error: unknown }) {
  const msg = error instanceof Error ? error.message : "Erreur inconnue";
  // The search/chat engine is a local LLM (Ollama). Surface that when it's down.
  const isOllamaDown = msg.includes("Ollama") || msg.includes("introuvable");

  return (
    <div className="px-6">
      <p className="text-xs text-muted-foreground">
        Recherche : <span className="text-navy">« {query} »</span>
      </p>
      <div className="mt-6 border border-border bg-cream p-8 text-center">
        <p className="font-serif text-lg leading-snug text-navy">
          {isOllamaDown ? "Assistant IA indisponible" : "Impossible de charger les résultats"}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {isOllamaDown ? msg : "Réessaie dans un instant ou affine ta recherche via le chat."}
        </p>
        <Link
          to="/chat"
          className="mt-6 inline-block bg-navy px-5 py-3 text-[11px] uppercase tracking-[0.28em] text-cream transition hover:opacity-90"
        >
          Retour au chat
        </Link>
      </div>
    </div>
  );
}

function ResultView({
  result,
  onAdd,
}: {
  result: SearchResult;
  onAdd: (item: Parameters<ReturnType<typeof useCart>["add"]>[0]) => void;
}) {
  const isLink = result.mode === "link";
  const originalPrice = result.original.price;
  // Prefer real photos (link mode); fall back to category placeholders.
  const originalImage = result.original.image ?? imageForCategory(result.original.imageCategory);
  const vintedImage = result.vinted.image ?? imageForCategory(result.vinted.imageCategory);
  const outlet = result.outlet;
  const outletImage = outlet ? (outlet.image ?? imageForCategory(outlet.imageCategory)) : "";

  return (
    <>
      <p className="mx-6 text-sm leading-relaxed text-muted-foreground">
        {isLink
          ? "ADA a lu la page produit, interrogé Vinted en direct et estimé le meilleur moment d'achat pour "
          : "ADA a analysé les marques, le marché de la seconde main et les déstockages pour "}
        <span className="text-navy">« {result.query} »</span>.
      </p>

      <div className="mt-8 space-y-4 px-6">
        <Column
          index={0}
          eyebrow="Original"
          badge={{
            label: result.original.status,
            tone: result.original.status === "WAIT" ? "wait" : "save",
          }}
          title={result.original.name}
          subtitle={result.original.brand}
          price={result.original.price}
          originalPrice={originalPrice}
          image={originalImage}
          icon={<Clock className="h-4 w-4" />}
          message={result.original.promoMessage}
          link={result.original.link}
          onAdd={() =>
            onAdd({
              name: result.original.name,
              brand: result.original.brand,
              price: result.original.price,
              originalPrice,
              image: originalImage,
              source: "original",
              link: result.original.link,
            })
          }
        />

        <Column
          index={1}
          eyebrow="Alternative Vinted"
          badge={{
            label: `−${result.vinted.discount}%`,
            tone: "save",
          }}
          title={result.vinted.title}
          subtitle={result.vinted.condition}
          price={result.vinted.price}
          originalPrice={originalPrice}
          image={vintedImage}
          icon={<Tag className="h-4 w-4" />}
          message={
            result.vinted.real
              ? `Annonce réelle Vinted · ${result.vinted.condition}.`
              : `Estimation Vinted · ${result.vinted.condition}.`
          }
          link={result.vinted.link}
          onAdd={() =>
            onAdd({
              name: result.vinted.title,
              brand: result.vinted.condition,
              price: result.vinted.price,
              originalPrice,
              image: vintedImage,
              source: "vinted",
              link: result.vinted.link,
            })
          }
        />

        {outlet && (
          <Column
            index={2}
            eyebrow={isLink ? "Aussi sur Vinted" : "Déstockage marque"}
            badge={{ label: `−${outlet.discount}%`, tone: "gold" }}
            title={isLink ? (outlet.title ?? `Vinted — ${result.query}`) : `Outlet — ${result.query}`}
            subtitle={isLink ? (outlet.condition ?? "Bon état") : outlet.brand}
            price={outlet.price}
            originalPrice={originalPrice}
            image={outletImage}
            icon={<Sparkles className="h-4 w-4" />}
            message={isLink ? "Seconde annonce réelle Vinted." : "Offre membres · stock limité."}
            link={outlet.link}
            onAdd={() =>
              onAdd({
                name: isLink ? (outlet.title ?? `Vinted — ${result.query}`) : `Outlet — ${result.query}`,
                brand: isLink ? "Vinted" : outlet.brand,
                price: outlet.price,
                originalPrice,
                image: outletImage,
                source: isLink ? "vinted" : "outlet",
                link: outlet.link,
              })
            }
          />
        )}
      </div>

      <div className="mt-10 px-6">
        <Link
          to="/chat"
          className="block w-full bg-navy py-4 text-center text-[11px] uppercase tracking-[0.32em] text-cream transition hover:opacity-90"
        >
          Affiner avec ADA
        </Link>
      </div>
    </>
  );
}

function Column({
  index,
  eyebrow,
  badge,
  title,
  subtitle,
  price,
  originalPrice,
  image,
  icon,
  message,
  link,
  onAdd,
}: {
  index: number;
  eyebrow: string;
  badge: { label: string; tone: "wait" | "save" | "gold" };
  title: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  image: string;
  icon: React.ReactNode;
  message: string;
  link?: string;
  onAdd: () => void;
}) {
  const [added, setAdded] = useState(false);
  const badgeStyles =
    badge.tone === "wait"
      ? "bg-navy text-cream"
      : badge.tone === "save"
        ? "border border-navy text-navy bg-cream"
        : "bg-gold text-gold-foreground";

  const savings = Math.max(0, originalPrice - price);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="overflow-hidden border border-border bg-cream"
    >
      <div className="grid grid-cols-[120px_1fr] gap-0">
        <div className="relative aspect-square overflow-hidden">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full w-full cursor-pointer"
              aria-label={`Ouvrir ${title}`}
            >
              <SafeImage
                src={image}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-200 ease-in-out hover:scale-[1.02]"
              />
            </a>
          ) : (
            <SafeImage src={image} alt={title} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex min-w-0 flex-col p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</p>
            <span className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${badgeStyles}`}>
              {badge.label}
            </span>
          </div>
          <h3 className="mt-2 font-serif text-lg leading-tight text-navy">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <div className="mt-auto flex items-baseline gap-2 pt-3">
            <span className="font-serif text-2xl text-navy">{price.toFixed(2)}</span>
            <span className="font-serif text-sm text-gold">€</span>
            {savings > 0 && (
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-gold">
                −{savings.toFixed(0)}€
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-4 py-3 text-xs text-navy">
        <span className="text-gold">{icon}</span>
        <span className="flex-1 leading-snug">{message}</span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[10px] uppercase tracking-[0.24em] text-navy underline-offset-4 hover:underline"
          >
            Voir
          </a>
        )}
      </div>
      <button
        onClick={() => {
          if (added) return;
          onAdd();
          setAdded(true);
        }}
        className={`flex w-full items-center justify-center gap-2 border-t border-border py-3 text-[11px] uppercase tracking-[0.28em] transition ${
          added ? "bg-cream text-gold" : "bg-cream text-navy hover:bg-navy hover:text-cream"
        }`}
      >
        {added ? (
          <>
            <Check className="h-4 w-4" /> Ajouté au Super-Panier
          </>
        ) : (
          "Ajouter au Super-Panier"
        )}
      </button>
    </motion.article>
  );
}
