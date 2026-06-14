import * as cheerio from "cheerio";

// Server-only scraping helpers. The .server.ts suffix keeps cheerio and the
// network code out of the client bundle.
//
// Ported from the previous Express backend (server/vinted.js + server/scraper.js)
// to fetch (no axios). Two capabilities:
//   - searchVinted(): real Vinted listings via the guest token + catalog API
//   - scrapeProductPage(): level-1 product extraction (JSON-LD / OpenGraph / DOM)

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const STOP_WORDS = new Set([
  "de", "la", "le", "les", "du", "des", "un", "une", "avec", "pour", "en",
  "et", "ou", "à", "the", "a", "of", "for", "with", "and",
]);

// ---------- Keyword extraction ----------

export function extractKeywords(nom?: string, marque?: string): string[] {
  const words = `${marque ?? ""} ${nom ?? ""}`
    .toLowerCase()
    .replace(/[^a-zéèêëàâùûüîïôœç0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 4);
}

// ---------- Vinted guest token (auto-renewed) ----------

let vintedToken: string | null = null;
let vintedTokenExpiry = 0;

async function getVintedToken(): Promise<string> {
  if (vintedToken && Date.now() < vintedTokenExpiry) return vintedToken;

  const res = await fetch("https://www.vinted.fr/", {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });

  // The access_token_web cookie lives in the Set-Cookie headers.
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    const m = cookie.match(/access_token_web=([^;]+)/);
    if (m) {
      vintedToken = m[1];
      vintedTokenExpiry = Date.now() + 55 * 60 * 1000; // 55 min (expires after 1h)
      return vintedToken;
    }
  }
  throw new Error("Impossible de récupérer le token Vinted");
}

export type VintedItem = {
  id: string;
  title: string;
  price: number;
  url: string;
  image: string | null;
  condition: string | null;
};

type VintedApiItem = {
  id: number;
  title?: string;
  price?: { amount?: string } | string | number;
  url?: string;
  photo?: { url?: string; full_size_url?: string } | null;
  status?: string;
};

// ---------- Vinted search (relevance + price band, anti-junk) ----------

export async function searchVinted(
  keywords: string[],
  prixRef: number | null,
  opts: { min?: number; max?: number; limit?: number } = {},
): Promise<VintedItem[]> {
  const { min = 0, max = Infinity, limit = 6 } = opts;
  const query = keywords.join(" ");
  if (!query.trim()) return [];

  const token = await getVintedToken();
  const params = new URLSearchParams({
    search_text: query,
    per_page: "32",
    order: "relevance",
    currency: "EUR",
  });

  const res = await fetch(
    `https://www.vinted.fr/api/v2/catalog/items?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": UA,
        Accept: "application/json",
        Referer: "https://www.vinted.fr/",
      },
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!res.ok) throw new Error(`Vinted API ${res.status}`);
  const data = (await res.json()) as { items?: VintedApiItem[] };
  const rawItems = data.items ?? [];

  const priceOf = (item: VintedApiItem): number => {
    const p = item.price;
    if (p && typeof p === "object") return parseFloat(p.amount ?? "0");
    return parseFloat(String(p ?? 0));
  };

  // Significant keywords (>= 4 letters) to score title relevance.
  const kw = [...new Set(keywords.map((k) => k.toLowerCase()).filter((k) => k.length >= 4))];

  const scored = rawItems
    .map((item) => {
      const prix = priceOf(item);
      const title = (item.title ?? "").toLowerCase();
      const matches = kw.filter((k) => title.includes(k)).length;
      return { item, prix, matches };
    })
    .filter((x) => x.prix > 0 && x.item.photo && (kw.length === 0 || x.matches >= 1));

  // Price band: avoids 3€ junk when looking for quality.
  const inBand = scored.filter((x) => x.prix >= min && x.prix <= max);
  // If the band leaves too few options, relax it so we don't end up empty.
  const pool = inBand.length >= 2 ? inBand : scored;

  // Sort: relevance first, then ascending price.
  pool.sort((a, b) => b.matches - a.matches || a.prix - b.prix);

  // Fallback: if nothing matched, keep raw results within band by price.
  const finalList =
    pool.length > 0
      ? pool
      : rawItems
          .map((item) => ({ item, prix: priceOf(item), matches: 0 }))
          .filter((x) => x.prix >= min && x.prix <= max && x.item.photo)
          .sort((a, b) => a.prix - b.prix);

  return finalList.slice(0, limit).map(({ item, prix }) => ({
    id: `vinted-${item.id}`,
    title: item.title ?? "Article",
    price: prix,
    url: item.url?.startsWith("http")
      ? item.url
      : `https://www.vinted.fr${item.url ?? ""}`,
    image: item.photo?.full_size_url ?? item.photo?.url ?? null,
    condition: item.status ?? null,
  }));
}

// ---------- Level-1 product page scraper (fetch + cheerio) ----------

export type ScrapedProduct = {
  nom: string | null;
  marque: string | null;
  prix_actuel: number | null;
  image: string | null;
};

function buildHeaders(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
}

type LdProduct = {
  "@type"?: string | string[];
  "@graph"?: LdProduct[];
  name?: string;
  brand?: { name?: string } | string;
  image?: string | string[] | { url?: string };
  offers?: { price?: string; lowPrice?: string } | { price?: string; lowPrice?: string }[];
};

function parseJsonLd($: cheerio.CheerioAPI): LdProduct | null {
  let found: LdProduct | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) return;
    try {
      const json = JSON.parse($(el).text()) as LdProduct;
      const isProduct = (n: LdProduct) =>
        n["@type"] === "Product" ||
        (Array.isArray(n["@type"]) && n["@type"].includes("Product"));
      const product = isProduct(json)
        ? json
        : Array.isArray(json["@graph"])
          ? json["@graph"].find(isProduct) ?? null
          : null;
      if (product) found = product;
    } catch {
      /* ignore malformed JSON-LD */
    }
  });
  return found;
}

function fromJsonLd(p: LdProduct): ScrapedProduct {
  const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const price = parseFloat(String(offer?.price ?? offer?.lowPrice ?? "").replace(",", "."));
  const img = Array.isArray(p.image) ? p.image[0] : p.image;
  return {
    nom: p.name ?? null,
    marque: typeof p.brand === "string" ? p.brand : (p.brand?.name ?? null),
    prix_actuel: Number.isNaN(price) ? null : price,
    image: typeof img === "string" ? img : (img?.url ?? null),
  };
}

function fromOg($: cheerio.CheerioAPI): ScrapedProduct {
  const get = (prop: string) =>
    $(`meta[property="${prop}"]`).attr("content") ??
    $(`meta[name="${prop}"]`).attr("content") ??
    null;
  const priceRaw = get("product:price:amount") ?? get("og:price:amount");
  const price = priceRaw ? parseFloat(priceRaw.replace(",", ".")) : null;
  return {
    nom: get("og:title"),
    marque: get("og:site_name"),
    prix_actuel: price !== null && !Number.isNaN(price) ? price : null,
    image: get("og:image"),
  };
}

function fromSelectors($: cheerio.CheerioAPI): ScrapedProduct {
  const text = (sels: string[]) =>
    sels.map((s) => $(s).first().text().trim()).find(Boolean) ?? null;
  const attr = (sels: string[], a: string) =>
    sels.map((s) => $(s).first().attr(a)).find(Boolean) ?? null;
  const priceRaw = text([
    '[itemprop="price"]',
    '[class*="current-price"]',
    '[class*="price--current"]',
    '[class*="prix"]',
  ]);
  const price = priceRaw
    ? parseFloat(priceRaw.replace(/[^\d,.]/g, "").replace(",", "."))
    : null;
  return {
    nom: text(['h1[itemprop="name"]', ".product-title", ".product-name", "h1"]),
    marque: null,
    prix_actuel: price !== null && !Number.isNaN(price) ? price : null,
    image: attr(
      ['img[itemprop="image"]', 'img[class*="product"][src]', 'img[class*="hero"][src]'],
      "src",
    ),
  };
}

function parseHtml(html: string): ScrapedProduct {
  const $ = cheerio.load(html);
  const ld = parseJsonLd($);
  if (ld) {
    const r = fromJsonLd(ld);
    if (r.nom && r.prix_actuel) return r;
  }
  const og = fromOg($);
  if (og.nom && og.prix_actuel) return og;
  return fromSelectors($);
}

// SSRF guard: only allow public http(s) URLs. Blocks localhost, private,
// loopback and link-local (cloud metadata) addresses so a user-supplied link
// can't make the server reach internal services (e.g. Ollama on :11434).
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;

  // IPv6 literal (URL hostnames keep brackets stripped) — block loopback/ULA/link-local.
  if (host.includes(":")) {
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return false;
    return true;
  }

  // IPv4 literal — block private / loopback / link-local / unspecified ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = m.slice(1).map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    return true;
  }

  // A hostname with no dot is almost always an intranet name — reject.
  return host.includes(".");
}

const MAX_SCRAPE_BYTES = 3_000_000; // cap parsed HTML to avoid huge-response DoS

/**
 * Level-1 scraper: HTTP fetch + cheerio parse (JSON-LD → OpenGraph → DOM).
 * Returns null on block / network error / empty page (or a non-public URL) so
 * callers can fall back to URL-based heuristics. No Playwright (level 2 dropped).
 */
export async function scrapeProductPage(url: string): Promise<ScrapedProduct | null> {
  if (!isPublicHttpUrl(url)) return null;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: buildHeaders(),
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    return null;
  }

  if (res.status === 403 || res.status === 429) return null;

  const html = (await res.text().catch(() => "")).slice(0, MAX_SCRAPE_BYTES);
  const blocked =
    html.includes("Just a moment") ||
    html.includes("Enable JavaScript and cookies") ||
    html.includes("cf-browser-verification") ||
    html.includes("Access Denied");
  if (blocked) return null;

  const result = parseHtml(html);
  return result.nom ? result : null;
}
