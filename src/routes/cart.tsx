import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Header } from "@/components/ada/AppShell";
import { SafeImage } from "@/components/ada/SafeImage";
import { useCart } from "@/lib/ada-store";
import { Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "ADA — Super-Panier" }] }),
  component: CartPage,
});

const SOURCE_LABEL: Record<string, string> = {
  original: "Original",
  vinted: "Vinted",
  outlet: "Outlet",
};

function CartPage() {
  const { items, remove, clear, savings } = useCart();
  const total = items.reduce((s, i) => s + i.price, 0);

  return (
    <AppShell>
      <Header eyebrow="Super-Panier" title="Ton panier actuel." />

      <div className="mx-6 border border-border bg-navy p-6 text-cream">
        <p className="text-[10px] uppercase tracking-[0.32em] text-cream/70">Economies accumulées</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-serif text-5xl text-cream">+{savings}</span>
          <span className="font-serif text-2xl text-gold">€</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-cream/15 pt-4 text-xs text-cream/80">
          <span>{items.length} item{items.length === 1 ? "" : "s"}</span>
          <span>total du panier · {total}€</span>
        </div>
      </div>

      <div className="mt-8 px-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border bg-cream p-10 text-center">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-serif text-xl text-navy">Panier vide.</p>
            <p className="text-xs text-muted-foreground">
              Cherche une pièce, laisse ADA trouver les meilleures alternatives, puis ajoute celle que tu préfères.
            </p>
            <Link
              to="/search"
              className="mt-2 bg-navy px-5 py-3 text-[11px] uppercase tracking-[0.28em] text-cream transition hover:opacity-90"
            >
              Commencer la recherche
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border border-y border-border">
              {items.map((i) => (
                <li key={i.id} className="flex gap-4 py-4">
                  {i.link ? (
                    <a
                      href={i.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block h-20 w-20 shrink-0 cursor-pointer overflow-hidden"
                      aria-label={`Ouvrir ${i.name} dans un nouvel onglet`}
                    >
                      <SafeImage
                        src={i.image}
                        alt={i.name}
                        className="h-full w-full object-cover transition-transform duration-200 ease-in-out hover:scale-[1.02]"
                      />
                    </a>
                  ) : (
                    <SafeImage src={i.image} alt={i.name} className="h-20 w-20 shrink-0 object-cover" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-gold">{SOURCE_LABEL[i.source]}</p>
                      <button
                        onClick={() => remove(i.id)}
                        className="text-muted-foreground transition hover:text-navy"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="font-serif text-base leading-tight text-navy">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.brand}</p>
                    <div className="mt-auto flex items-baseline gap-2 pt-2">
                      {i.price === 0 && i.originalPrice === 0 ? (
                        <span className="font-serif text-sm italic text-muted-foreground">En cours d'analyse</span>
                      ) : (
                        <>
                          <span className="font-serif text-lg text-navy">{i.price}€</span>
                          {i.originalPrice > i.price && (
                            <span className="text-xs text-muted-foreground line-through">{i.originalPrice}€</span>
                          )}
                          {i.originalPrice > i.price && (
                            <span className="ml-auto text-[10px] uppercase tracking-[0.24em] text-gold">
                              −{i.originalPrice - i.price}€
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={clear}
              className="mt-6 w-full border border-border bg-cream py-3 text-[11px] uppercase tracking-[0.28em] text-navy transition hover:border-navy"
            >
              Vider le panier
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}
