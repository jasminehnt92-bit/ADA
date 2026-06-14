import { useEffect, useState } from "react";

export type Choice = "left" | "right";

export type Profile = {
  name: string;
  email: string;
  age?: string;
  sex?: string;
  birthday?: string;
  preferences: Record<string, Choice>;
  onboarded: boolean;
};

export type CartItem = {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice: number;
  image: string;
  source: "original" | "vinted" | "outlet";
  link?: string;
  addedAt: number;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const PROFILE_KEY = "ada-profile-v2";
const CART_KEY = "ada-cart-v2";
const CONVERSATION_KEY = "ada-conversation-v2";

const DEFAULT_PROFILE: Profile = {
  name: "",
  email: "",
  preferences: {},
  onboarded: false,
};

// ---------- Preference labels ----------

export const PREFERENCE_LABELS: Record<string, { left: string; right: string }> = {
  style: { left: "Minimalist / Classic", right: "Bold / Trends" },
  values: { left: "Quality over quantity", right: "Variety / Fast-fashion" },
  source: { left: "Second-hand first", right: "Brand new" },
  budget: { left: "Student / tight budget", right: "Stable salary" },
  origin: { left: "Made in France / Europe", right: "Global brands" },
  frequency: { left: "Rare, thoughtful", right: "Frequent / impulsive" },
  wait: { left: "Can wait 30 days", right: "I need it now" },
  material: { left: "Natural fibres", right: "Synthetic / low cost" },
  occasion: { left: "Uni / work", right: "Party / going out" },
  goal: { left: "Build a capsule wardrobe", right: "Find a one-off piece" },
};

// ---------- Category images ----------

export const CATEGORY_IMAGES: Record<string, string> = {
  coat: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&q=80",
  trench: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&q=80",
  skirt: "https://images.unsplash.com/photo-1582142306909-195724d33ffc?w=400&q=80",
  dress: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80",
  shoes: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80",
  loafers: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&q=80",
  bag: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&q=80",
  top: "https://images.unsplash.com/photo-1485231183945-fffde7cc051e?w=400&q=80",
  blouse: "https://images.unsplash.com/photo-1485231183945-fffde7cc051e?w=400&q=80",
  jeans: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80",
  jacket: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80",
  accessories: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
};

export function imageForCategory(category?: string): string {
  if (!category) return CATEGORY_IMAGES.accessories;
  const normalized = (category || "").toLowerCase();
  return CATEGORY_IMAGES[normalized] ?? CATEGORY_IMAGES.accessories;
}

export function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: Profile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);
  const update = (patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  };
  return { profile, update, ready };
}

// ---------- Conversation ----------

export function loadConversation(): ConversationMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONVERSATION_KEY);
    return raw ? (JSON.parse(raw) as ConversationMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveConversation(msgs: ConversationMessage[]) {
  if (typeof window === "undefined") return;
  // Keep last 40 messages to avoid token overflow
  localStorage.setItem(CONVERSATION_KEY, JSON.stringify(msgs.slice(-40)));
}

export function clearConversation() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONVERSATION_KEY);
}

// ---------- Cart ----------

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("ada-cart-change"));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(loadCart());
    const sync = () => setItems(loadCart());
    window.addEventListener("ada-cart-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ada-cart-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const add = (item: Omit<CartItem, "id" | "addedAt">) => {
    const next = [
      ...loadCart(),
      { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, addedAt: Date.now() },
    ];
    saveCart(next);
    setItems(next);
  };
  const remove = (id: string) => {
    const next = loadCart().filter((i) => i.id !== id);
    saveCart(next);
    setItems(next);
  };
  const clear = () => {
    saveCart([]);
    setItems([]);
  };
  const savings = items.reduce((s, i) => s + Math.max(0, i.originalPrice - i.price), 0);
  return { items, add, remove, clear, savings };
}

// ---------- Dashboard Stats ----------

export type DashboardStats = {
  totalSavings: number;
  totalPurchases: number;
  waitedCount: number;
  swappedCount: number;
  outletCount: number;
};

const DEFAULT_STATS: DashboardStats = {
  totalSavings: 0,
  totalPurchases: 0,
  waitedCount: 0,
  swappedCount: 0,
  outletCount: 0,
};

// Stats are DERIVED from the cart (single source of truth) so they stay correct
// when items are added, removed or cleared — no separate accumulator to drift.
function statsFromCart(items: CartItem[]): DashboardStats {
  return {
    totalSavings: items.reduce((s, i) => s + Math.max(0, i.originalPrice - i.price), 0),
    totalPurchases: items.length,
    waitedCount: items.filter((i) => i.source === "original").length,
    swappedCount: items.filter((i) => i.source === "vinted").length,
    outletCount: items.filter((i) => i.source === "outlet").length,
  };
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  useEffect(() => {
    const sync = () => setStats(statsFromCart(loadCart()));
    sync();
    window.addEventListener("ada-cart-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ada-cart-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return stats;
}

// ---------- Fashion pools (local images from /styles/) ----------

const local = (folder: string, file: string) => `/styles/${folder}/${file}`;

// minimalist → style classique/épuré
// romantic → style classique/élégant/féminin
const CLASSIC_POOL: string[] = [
  local("minimalist", "23cfd71a9a37468d2ee3cde9fa324909.jpg"),
  local("minimalist", "2f34920ebbc29533faa99f5d7a1200ab.jpg"),
  local("minimalist", "385220d9ab35a4df8be0ec5fe64eaa23.jpg"),
  local("minimalist", "6d1bf96e9c7705b49e25691c6db110ac.jpg"),
  local("romantic", "5ec74a78eb1bbdd1a8e33cd0ad69a015.jpg"),
  local("romantic", "9a7d473fb2b6d3e7ba3b82f7fe2e50a2.jpg"),
  local("romantic", "9cc4c1542c15aee9c27df421de761042.jpg"),
  local("romantic", "e529d475de3af43125a3acd247cbcbf5.jpg"),
];

// bold + streatwear → style statement/urbain
const BOLD_POOL: string[] = [
  local("bold", "0bb9d9606f2bb0e206deab39a020ee9d.jpg"),
  local("bold", "3e23ef40a74270075b0c8a516bc0859a.jpg"),
  local("bold", "42aa2886d3a1b7db1d17138c42978a4b.jpg"),
  local("bold", "a6e3bb9fe879c1f554c5341d1832ad04.jpg"),
  local("streatwear", "099ed4be02833a8aba0ebd1a5fa0b4ed.jpg"),
  local("streatwear", "2effb95f3f2a9fc048715f716dd8a748.jpg"),
  local("streatwear", "44a047f1970c9268c90fd1914faad2b4.jpg"),
  local("streatwear", "f48cd73cb905d0b8fe9142313725cda9.jpg"),
];

/**
 * Returns n moodboard images personalized to the user's profile.
 * 75% from their primary style pool, 25% from the contrasting one for variety.
 * seed parameter allows client-side reshuffling without re-fetching.
 */
export function homeMoodboardImages(
  prefs: Record<string, Choice>,
  n = 8,
): string[] {
  const hasPref = Object.keys(prefs).length > 0;

  if (!hasPref) {
    // No profile yet — equal mix of both pools
    return pickRandom([...CLASSIC_POOL, ...BOLD_POOL], n);
  }

  const isBold = prefs["style"] === "right";
  const primary = isBold ? BOLD_POOL : CLASSIC_POOL;
  const secondary = isBold ? CLASSIC_POOL : BOLD_POOL;

  // Occasion skews toward evening photos when user prefers going out
  const isEvening = prefs["occasion"] === "right";
  // For evening prefer the night-themed curated ones (already in pools above)

  const primaryN = Math.ceil(n * 0.75);
  const secondaryN = n - primaryN;

  const picked = [
    ...pickRandom(primary, primaryN),
    ...pickRandom(secondary, secondaryN),
  ];

  // Shuffle the combined result so it doesn't look split
  return pickRandom(picked, picked.length);
}

// ---------- Moodboard → master prompt ----------

// Style descriptor per image family. Local pools live under /styles/<folder>/,
// so we recognise the folder; unsplash curated images fall back to the profile.
const STYLE_DESCRIPTORS: Record<string, string> = {
  minimalist: "un style minimaliste épuré : lignes nettes, coupes structurées, palette de tons neutres",
  romantic: "un style romantique et féminin : matières fluides, détails délicats, silhouettes douces",
  bold: "un style affirmé et statement : couleurs et coupes audacieuses, pièces qui se remarquent",
  streatwear: "un look streetwear urbain et décontracté : pièces oversize, sneakers, esprit casual",
};

function descriptorForImage(src: string): string | null {
  const folder = src.match(/\/styles\/([^/]+)\//)?.[1];
  if (folder && STYLE_DESCRIPTORS[folder]) return STYLE_DESCRIPTORS[folder];
  return null;
}

/**
 * Turns a selected moodboard image into a "master prompt": a first-person
 * opening message that seeds ADA's funnel with the image's style + the user's
 * known profile (budget, source, origin). ADA then asks for the missing
 * details (exact item, occasion) and concludes with real products.
 */
export function buildMoodboardMasterPrompt(
  src: string,
  prefs: Record<string, Choice> = {},
): string {
  const styleFromImage = descriptorForImage(src);
  const styleFromProfile =
    prefs["style"] === "right" ? STYLE_DESCRIPTORS.bold : STYLE_DESCRIPTORS.minimalist;
  const style = styleFromImage ?? styleFromProfile;

  const hints: string[] = [];
  if (prefs["budget"] === "left") hints.push("avec un budget serré");
  if (prefs["budget"] === "right") hints.push("je peux mettre le prix pour de la qualité");
  if (prefs["source"] === "left") hints.push("je préfère la seconde main");
  if (prefs["origin"] === "left") hints.push("idéalement Made in France ou Europe");
  const hintLine = hints.length ? ` ${hints.join(", ")}.` : "";

  return `Je suis inspirée par ${style}. Aide-moi à trouver une pièce dans cet esprit.${hintLine}`;
}

