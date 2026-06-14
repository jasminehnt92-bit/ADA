import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, MessageCircle, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/lib/ada-store";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/cart", label: "Panier", icon: ShoppingBag },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { items } = useCart();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-cream/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          const showBadge = to === "/cart" && items.length > 0;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                  active ? "text-navy" : "text-muted-foreground hover:text-navy"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  {showBadge && (
                    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[9px] font-medium text-gold-foreground">
                      {items.length}
                    </span>
                  )}
                </span>
                <span>{label}</span>
                <span className={`mt-0.5 h-px w-6 transition-colors ${active ? "bg-gold" : "bg-transparent"}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
