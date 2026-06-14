// Server-only deterministic price model. Ported from the previous backend
// (server/priceModel.js) — NO LLM. White-box: French sales calendar + brand
// factors + category seasonality + a synthetic-but-reproducible 12-month
// history, read to find the next price dip and a BUY/WAIT recommendation.

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

type SalesEvent = { key: string; label: string; month: number; day: number; baseDiscount: number };

const SALES_EVENTS: SalesEvent[] = [
  { key: "soldes_hiver", label: "soldes d'hiver", month: 0, day: 7, baseDiscount: 0.3 },
  { key: "french_days_print", label: "French Days de printemps", month: 3, day: 29, baseDiscount: 0.2 },
  { key: "soldes_ete", label: "soldes d'été", month: 5, day: 24, baseDiscount: 0.3 },
  { key: "french_days_aut", label: "French Days d'automne", month: 8, day: 23, baseDiscount: 0.2 },
  { key: "black_friday", label: "Black Friday", month: 10, day: 27, baseDiscount: 0.35 },
];

// Per-brand discount modulators (multiply base discount). >1 sells off hard, <1 premium.
const BRAND_FACTORS: Record<string, Record<string, number>> = {
  "the north face": { default: 1.1, black_friday: 1.3 },
  nike: { default: 1.0, french_days_print: 1.1, soldes_ete: 1.15, black_friday: 1.1 },
  adidas: { default: 1.0, black_friday: 1.1 },
  patagonia: { default: 0.55, soldes_hiver: 0.9 },
  decathlon: { default: 0.7 },
  zara: { default: 1.2, soldes_hiver: 1.3, soldes_ete: 1.3 },
  zalando: { default: 1.25, black_friday: 1.3 },
  lacoste: { default: 0.9 },
  salomon: { default: 0.85 },
  columbia: { default: 1.0, black_friday: 1.2 },
  sezane: { default: 0.8 },
  uniqlo: { default: 0.85 },
  mango: { default: 1.15, soldes_ete: 1.25 },
};

type CategoryRule = { key: string; match: RegExp; volatility: number; drift: number; discountMod: number };

const CATEGORY_RULES: CategoryRule[] = [
  { key: "chaussures", match: /(chaussure|basket|sneaker|running|trail|air ?max|stan ?smith|bottes?|sandale|mocassin|loafer|escarpin)/i, volatility: 1.1, drift: -0.05, discountMod: 1.1 },
  { key: "veste", match: /(veste|manteau|doudoune|parka|blouson|jacket|gore.?tex|coupe.?vent|softshell|anorak|trench|blazer)/i, volatility: 1.25, drift: -0.04, discountMod: 1.15 },
  { key: "robe", match: /(robe|jupe|combinaison)/i, volatility: 1.2, drift: -0.04, discountMod: 1.1 },
  { key: "haut", match: /(t.?shirt|tee|polo|sweat|hoodie|pull|chemise|maillot|blouse|top)/i, volatility: 0.9, drift: -0.03, discountMod: 1.0 },
  { key: "sac", match: /(sac|bag|pochette|tote|cabas|besace)/i, volatility: 0.85, drift: -0.02, discountMod: 0.95 },
];

const round = (n: number) => Math.round(n);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const norm = (s?: string) => (s ?? "").toString().trim().toLowerCase();

function detectCategory(nom?: string): CategoryRule | null {
  const s = norm(nom);
  if (!s) return null;
  return CATEGORY_RULES.find((c) => c.match.test(s)) ?? null;
}

// Deterministic hash (FNV-1a) → same product, same seed.
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextOccurrence(event: SalesEvent, from: Date): Date {
  const year = from.getFullYear();
  let d = new Date(year, event.month, event.day);
  if (d < from) d = new Date(year + 1, event.month, event.day);
  return d;
}

function monthDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

function eventForMonth(monthIdx: number, from: Date) {
  const exact = SALES_EVENTS.find((e) => e.month === monthIdx);
  const chosen =
    exact ?? [...SALES_EVENTS].sort((a, b) => monthDist(a.month, monthIdx) - monthDist(b.month, monthIdx))[0];
  return { ...chosen, date: nextOccurrence(chosen, from) };
}

function brandFactor(marque: string | undefined, eventKey: string): number {
  const b = BRAND_FACTORS[norm(marque)];
  if (!b) return 1;
  return b[eventKey] ?? b.default ?? 1;
}

type Point = { mois: string; prix: number };

function linearRegression(points: Point[]): { slope: number; r2: number } {
  const n = points.length;
  if (n < 3) return { slope: 0, r2: 0 };
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.prix);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept;
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, r2: clamp(r2, 0, 1) };
}

function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function monthlyDiscounts(marque: string | undefined, cat: CategoryRule | null): number[] {
  const arr = new Array(12).fill(0);
  const catMod = cat?.discountMod ?? 1;
  for (const ev of SALES_EVENTS) {
    const d = clamp(ev.baseDiscount * brandFactor(marque, ev.key) * catMod, 0.05, 0.55);
    const prev = (ev.month + 11) % 12;
    const next = (ev.month + 1) % 12;
    arr[ev.month] = Math.max(arr[ev.month], d);
    arr[prev] = Math.max(arr[prev], d * 0.4);
    arr[next] = Math.max(arr[next], d * 0.3);
  }
  return arr;
}

function generateHistory(prixActuel: number, marque: string | undefined, nom: string | undefined): Point[] {
  if (!prixActuel || prixActuel <= 0) return [];
  const seed = hashSeed(norm(marque) + "|" + norm(nom));
  const rand = mulberry32(seed);
  const cat = detectCategory(nom);
  const disc = monthlyDiscounts(marque, cat);
  const full = prixActuel;
  const yearDrift = -0.09 + rand() * 0.1;

  return MOIS.map((mois, i) => {
    const seasonal = disc[i];
    let prix = full * (1 + yearDrift * (i / 11));
    if (seasonal > 0) {
      const depth = clamp(seasonal * (0.85 + rand() * 0.3), 0.05, 0.6);
      prix *= 1 - depth;
    } else {
      prix *= 1 + (rand() - 0.5) * 0.04;
    }
    return { mois, prix: round(prix) };
  });
}

export type PricePrediction = {
  prix_predit: number;
  date_prediction: string;
  raison_prediction: string;
  statut: "acheter" | "attendre";
  confiance: number;
  economie_potentielle: number;
  prix_min_12m: number;
};

/**
 * Predicts the best future price and the buy/wait recommendation — deterministic.
 */
export function predictPrice(args: {
  prix_actuel: number;
  marque?: string;
  nom?: string;
  today?: Date;
}): PricePrediction {
  const now = args.today ?? new Date();
  const prix = Number(args.prix_actuel) || 0;
  const history = generateHistory(prix, args.marque, args.nom);

  const prixMin = history.length ? Math.min(...history.map((h) => h.prix)) : prix;
  const prixMax = history.length ? Math.max(...history.map((h) => h.prix)) : prix;

  // Read the curve: cheapest calendar month in the next 11.
  const nowMonth = now.getMonth();
  let best = { price: history[nowMonth]?.prix ?? prix, month: nowMonth };
  for (let k = 1; k <= 11; k++) {
    const m = (nowMonth + k) % 12;
    const price = history[m]?.prix ?? prix;
    if (price < best.price) best = { price, month: m };
  }

  const event = eventForMonth(best.month, now);
  const prixPredit = round(best.price);
  const baisse = prix > 0 ? Math.round((1 - prixPredit / prix) * 100) : 0;

  const { r2 } = linearRegression(history);

  const gainAttendu = prix - prixPredit;
  const ecartMin = prixMin > 0 ? (prix - prixMin) / prixMin : 0;
  const statut: "acheter" | "attendre" =
    gainAttendu < prix * 0.05 || ecartMin <= 0.04 ? "acheter" : "attendre";

  const amplitude = prixMax > 0 ? (prixMax - prixMin) / prixMax : 0;
  const confiance = clamp(round((0.45 + 0.35 * r2 + 0.4 * amplitude) * 100), 35, 95);
  const economie = statut === "acheter" ? 0 : Math.max(0, round(gainAttendu));

  const raison =
    statut === "acheter"
      ? `Prix déjà proche de son plus bas niveau sur 12 mois (${round(prixMin)}€). C'est le bon moment.`
      : `Creux attendu vers ${prixPredit}€ (-${baisse}%) pendant les ${event.label} (${frDate(event.date)}). Mieux vaut attendre.`;

  return {
    prix_predit: prixPredit,
    date_prediction: statut === "acheter" ? "Maintenant" : `${event.label} — ${frDate(event.date)}`,
    raison_prediction: raison,
    statut,
    confiance,
    economie_potentielle: economie,
    prix_min_12m: round(prixMin),
  };
}
