import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { AppShell, Header } from "@/components/ada/AppShell";
import { SafeImage } from "@/components/ada/SafeImage";
import { AnimatedNumber } from "@/components/ada/AnimatedNumber";
import { useProfile, useCart, useDashboardStats, homeMoodboardImages, imageForCategory } from "@/lib/ada-store";
import { parseProductLink } from "@/lib/api/ada.functions";
import { ArrowRight, Plus, Loader2, Shuffle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "ADA — Home" }] }),
  component: Home,
});

function Home() {
  const { profile, ready } = useProfile();
  const { add } = useCart();
  const stats = useDashboardStats();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const moodboardImages = useMemo(() => {
    return homeMoodboardImages(profile.preferences, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shuffleSeed]);

  // Alternating ratios for 8 images — creates editorial masonry feel
  const ratios = [
    "aspect-[3/4]", "aspect-[4/5]",
    "aspect-square", "aspect-[3/4]",
    "aspect-[4/5]", "aspect-square",
    "aspect-[3/4]", "aspect-[4/5]",
  ];

  const { mutateAsync: importLink, isPending: importingLink } = useMutation({
    mutationFn: (url: string) => parseProductLink({ data: { url } }),
    onSuccess: (product, url) => {
      add({
        name: product.name,
        brand: product.brand,
        price: product.price,
        originalPrice: product.originalPrice,
        image: imageForCategory(product.imageCategory),
        source: "original",
        link: url,
      });
      setLinkUrl("");
      toast.success("Produit capturé — on cherche les alternatives…", {
        description: `${product.brand} · ${product.name}`,
      });
      const searchQuery = [product.name, product.brand].filter(Boolean).join(" ");
      navigate({ to: "/analysis", search: { q: searchQuery } });
    },
    onError: () => {
      toast.error("Impossible d'analyser ce lien", {
        description: "Vérifie l'URL ou ajoute l'article manuellement.",
      });
    },
  });

  const handleImportLink = () => {
    if (!linkUrl.trim() || importingLink) return;
    let url = linkUrl.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    importLink(url);
  };

  return (
    <AppShell>
      <Header
        eyebrow={`Bonjour${profile.name ? `, ${profile.name.split(" ")[0]}` : ""} `}
        title="Ton style. Ton budget. Zéro compromis."
      />

      {/* Savings dashboard */}
      <section className="mx-6 border border-border bg-cream p-6">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Économies cumulées</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-6xl font-medium text-navy">
            +<AnimatedNumber value={Math.round(stats.totalSavings)} />
          </span>
          <span className="font-serif text-2xl text-gold">€</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Sur <AnimatedNumber value={stats.totalPurchases} /> article{stats.totalPurchases !== 1 ? "s" : ""} considéré{stats.totalPurchases !== 1 ? "s" : ""}.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
          <Stat label="Attendus" value={stats.waitedCount} />
          <Stat label="Vinted" value={stats.swappedCount} />
          <Stat label="Outlet" value={stats.outletCount} />
        </div>
      </section>

      {/* Moodboard */}
      <section className="mt-10 px-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              {Object.keys(profile.preferences).length > 0 ? "Actuellement pour toi" : "Inspiration du moment"}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-navy">Moodboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShuffleSeed((s) => s + 1)}
              className="flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground transition hover:text-navy"
              aria-label="Nouveau moodboard"
            >
              <Shuffle className="h-3 w-3" />
              Remix
            </button>
            <Link
              to="/search"
              className="text-[10px] uppercase tracking-[0.28em] text-navy underline-offset-4 hover:underline"
            >
              Affiner
            </Link>
          </div>
        </div>
        <div className="columns-2 gap-2 [column-fill:_balance]">
          {moodboardImages.map((src, i) => (
            <motion.figure
              key={`${src}-${i}-${shuffleSeed}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.45, ease: "easeOut" }}
              className={`mb-2 break-inside-avoid overflow-hidden bg-muted ${ratios[i % ratios.length]} group relative cursor-pointer`}
            >
              <Link to="/chat" className="block h-full w-full">
                <SafeImage
                  src={src}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                />
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />
                {/* CTA label */}
                <div className="absolute bottom-0 left-0 right-0 translate-y-1 px-3 py-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="text-[9px] uppercase tracking-[0.28em] text-cream">
                    Explorer ce style →
                  </p>
                </div>
              </Link>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* Ask ADA */}
      <section className="mt-10 px-6">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Ask ADA</p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-3 flex items-center border border-border bg-cream p-1 focus-within:border-navy"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Décrivez un besoin (ex. « jupe midi »)…"
            className="flex-1 bg-transparent px-4 py-3 text-sm text-navy placeholder:text-muted-foreground outline-none"
          />
          <Link
            to="/chat"
            className="grid h-10 w-10 place-items-center bg-navy text-cream transition hover:opacity-90"
            aria-label="Discuter avec ADA"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </form>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          ADA discute avec toi pour cibler exactement ce qu'il te faut.
        </p>
      </section>

      {/* Link capture */}
      <section className="mt-8 px-6 pb-4">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Capturer un article</p>
        <div className="mt-3 flex items-center border border-border bg-cream p-1 focus-within:border-navy">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleImportLink();
              }
            }}
            placeholder="Colle un lien produit (Zara, Sézane, Vinted…)"
            disabled={importingLink}
            className="flex-1 bg-transparent px-4 py-3 text-sm text-navy placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleImportLink}
            disabled={importingLink || !linkUrl.trim()}
            className="grid h-10 w-10 place-items-center bg-navy text-cream transition hover:opacity-90 disabled:opacity-40"
            aria-label="Importer l'article"
          >
            {importingLink ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          ADA capture l'article et cherche immédiatement les alternatives Vinted et destockage.
        </p>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-serif text-2xl text-navy">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
    </div>
  );
}
