import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { useProfile, imagesForSwipe, MEASUREMENT_FIELDS, type Choice, type Profile } from "@/lib/ada-store";
import { ArrowLeft, ArrowRight, Ruler } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to ADA" }] }),
  component: Onboarding,
});

type Card = {
  key: string;
  topic: string;
  left: { label: string; hint: string };
  right: { label: string; hint: string };
  image: string;
};

const PREF_CARDS: Card[] = [
  {
    key: "style",
    topic: "Style",
    left: { label: "Minimalist / Classic", hint: "Clean lines, neutral palette" },
    right: { label: "Bold / Trends", hint: "Colour, prints, statement pieces" },
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
  },
  {
    key: "values",
    topic: "Values",
    left: { label: "Quality over quantity", hint: "Fewer, better pieces" },
    right: { label: "Variety / Fast-fashion", hint: "New looks often" },
    image: "https://images.unsplash.com/photo-1485231183945-fffde7cc051e?w=800&q=80",
  },
  {
    key: "source",
    topic: "Source",
    left: { label: "Second-hand first", hint: "Vinted, Vestiaire, vintage" },
    right: { label: "Brand new", hint: "Fresh from the shop" },
    image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800&q=80",
  },
  {
    key: "budget",
    topic: "Budget",
    left: { label: "Student / tight budget", hint: "Keep it under €60" },
    right: { label: "Stable salary", hint: "Open to premium pieces" },
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80",
  },
  {
    key: "origin",
    topic: "Origin",
    left: { label: "Made in France / Europe", hint: "Traceable makers" },
    right: { label: "Global brands", hint: "All origins welcome" },
    image: "https://images.unsplash.com/photo-1551803091-e20673f15770?w=800&q=80",
  },
  {
    key: "frequency",
    topic: "Frequency",
    left: { label: "Rare, thoughtful", hint: "I plan each purchase" },
    right: { label: "Frequent / impulsive", hint: "I love a spontaneous buy" },
    image: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=800&q=80",
  },
  {
    key: "wait",
    topic: "Patience",
    left: { label: "Can wait 30 days for −50%", hint: "Discount over urgency" },
    right: { label: "I need it now", hint: "Speed over savings" },
    image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&q=80",
  },
  {
    key: "material",
    topic: "Material",
    left: { label: "Natural fibres", hint: "Cotton, wool, linen" },
    right: { label: "Synthetic / low cost", hint: "Polyester, blends" },
    image: "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=800&q=80",
  },
  {
    key: "occasion",
    topic: "Occasion",
    left: { label: "Uni / work", hint: "Day-to-day essentials" },
    right: { label: "Party / going out", hint: "Statement evening pieces" },
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
  },
  {
    key: "goal",
    topic: "Goal",
    left: { label: "Build a capsule wardrobe", hint: "Coherent, lasting set" },
    right: { label: "Find a one-off piece", hint: "Hunting something specific" },
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80",
  },
];

function Onboarding() {
  const navigate = useNavigate();
  const { profile, update } = useProfile();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    age: profile.age ?? "",
    sex: profile.sex ?? "",
  });
  const [cardIndex, setCardIndex] = useState(0);
  const [prefs, setPrefs] = useState<Record<string, Choice>>({});
  const [pool, setPool] = useState<string[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, string>>(() =>
    Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, profile[f.key]?.toString() ?? ""])),
  );

  const handleSubmitInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    update({ name: form.name, email: form.email, age: form.age || undefined, sex: form.sex || undefined });
    setStep(2);
  };

  const handleSwipe = (dir: Choice) => {
    const card = PREF_CARDS[cardIndex];
    const nextPrefs = { ...prefs, [card.key]: dir };
    const nextPool = [...pool, ...imagesForSwipe(cardIndex + 1, dir)];
    setPrefs(nextPrefs);
    setPool(nextPool);
    if (cardIndex + 1 >= PREF_CARDS.length) {
      update({ preferences: nextPrefs, moodboardPool: nextPool });
      setStep(3);
    } else {
      setCardIndex(cardIndex + 1);
    }
  };

  const finishOnboarding = (measurementsPatch: Partial<Profile>) => {
    update({ ...measurementsPatch, onboarded: true });
    navigate({ to: "/" });
  };

  const handleSubmitMeasurements = (e: React.FormEvent) => {
    e.preventDefault();
    const toNumber = (v: string) => (v.trim() ? Number(v) : undefined);
    const patch: Partial<Profile> = {};
    for (const f of MEASUREMENT_FIELDS) {
      patch[f.key] = toNumber(measurements[f.key] ?? "");
    }
    finishOnboarding(patch);
  };

  const handleSkipMeasurements = () => {
    finishOnboarding({});
  };

  return (
    <div className="min-h-screen bg-cream text-navy">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12">
        <div className="mb-10 flex flex-col items-center gap-4">
          <img src="/logo.jpeg" alt="ADA" className="h-40 w-auto object-contain" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Step {step} / 3</p>
        </div>

        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Accessible Elegance</p>
            <h1 className="font-serif text-4xl leading-tight">Let's get acquainted.</h1>
            <div className="mt-4 h-px w-12 bg-gold" />
            <p className="mt-4 text-sm text-muted-foreground">Trouve ta pépite. Préserve ton budget.</p>
            <form onSubmit={handleSubmitInfo} className="mt-10 space-y-8">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Your name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-2 w-full border-0 border-b border-border bg-transparent pb-2 font-serif text-xl text-navy outline-none focus:border-navy"
                  placeholder="Charlotte Dubois"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-2 w-full border-0 border-b border-border bg-transparent pb-2 font-serif text-xl text-navy outline-none focus:border-navy"
                  placeholder="charlotte@hello.com"
                />
              </label>
              <div className="grid grid-cols-2 gap-6">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Âge</span>
                  <input
                    type="number"
                    min="13"
                    max="120"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="mt-2 w-full border-0 border-b border-border bg-transparent pb-2 font-serif text-xl text-navy outline-none focus:border-navy"
                    placeholder="25"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Genre</span>
                  <select
                    value={form.sex}
                    onChange={(e) => setForm({ ...form, sex: e.target.value })}
                    className="mt-2 w-full border-0 border-b border-border bg-transparent pb-2 font-serif text-xl text-navy outline-none focus:border-navy"
                  >
                    <option value="">—</option>
                    <option value="Femme">Femme</option>
                    <option value="Homme">Homme</option>
                    <option value="Non-binaire">Non-binaire</option>
                    <option value="Non précisé">Préfère ne pas préciser</option>
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="mt-8 w-full bg-navy py-4 text-[11px] uppercase tracking-[0.32em] text-cream transition-opacity hover:opacity-90"
              >
                Continue
              </button>
            </form>
          </motion.div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Define your taste</p>
            <h1 className="font-serif text-3xl leading-tight">Swipe to teach me.</h1>
            <div className="mt-4 h-px w-12 bg-gold" />
            <p className="mt-3 text-xs text-muted-foreground">
              Left or right — pick what feels closest. 10 quick questions.
            </p>

            <div className="relative mx-auto mt-8 h-[440px] w-full max-w-sm">
              <AnimatePresence>
                {PREF_CARDS.slice(cardIndex, cardIndex + 2)
                  .reverse()
                  .map((card, i, arr) => {
                    const isTop = i === arr.length - 1;
                    return (
                      <SwipeCard
                        key={card.key}
                        card={card}
                        isTop={isTop}
                        depth={arr.length - 1 - i}
                        onSwipe={handleSwipe}
                      />
                    );
                  })}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={() => handleSwipe("left")}
                className="flex items-center gap-2 border border-border bg-cream px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-navy transition hover:border-navy"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                {PREF_CARDS[cardIndex].left.label}
              </button>
              <button
                onClick={() => handleSwipe("right")}
                className="flex items-center gap-2 bg-navy px-5 py-3 text-[11px] uppercase tracking-[0.24em] text-cream transition hover:opacity-90"
              >
                {PREF_CARDS[cardIndex].right.label}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mt-5 text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {cardIndex + 1} of {PREF_CARDS.length}
            </p>
          </div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-gold/40 bg-gold/10">
                <Ruler className="h-4 w-4 text-gold" strokeWidth={1.5} />
              </div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Fine-tune your fit</p>
            </div>
            <h1 className="mt-4 font-serif text-4xl leading-tight">Tes mensurations.</h1>
            <div className="mt-4 h-px w-12 bg-gold" />
            <p className="mt-4 text-sm text-muted-foreground">
              Totalement optionnel — quelques chiffres en plus, et on affine la coupe et la taille qu'on te propose.
              Renseigne ce que tu connais, laisse le reste vide.
            </p>

            <form onSubmit={handleSubmitMeasurements} className="mt-8 flex flex-1 flex-col">
              <div className="grid grid-cols-2 gap-x-6 gap-y-7">
                {MEASUREMENT_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{f.label}</span>
                    <div className="mt-2 flex items-baseline border-0 border-b border-border pb-2 focus-within:border-navy">
                      <input
                        type="number"
                        min="0"
                        max="250"
                        inputMode="numeric"
                        value={measurements[f.key] ?? ""}
                        onChange={(e) => setMeasurements({ ...measurements, [f.key]: e.target.value })}
                        className="w-full border-0 bg-transparent font-serif text-xl text-navy outline-none"
                        placeholder={f.placeholder}
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">cm</span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{f.hint}</p>
                  </label>
                ))}
              </div>

              <div className="mt-10 flex gap-4">
                <button
                  type="button"
                  onClick={handleSkipMeasurements}
                  className="flex-1 border border-border bg-cream py-4 text-[11px] uppercase tracking-[0.32em] text-navy transition hover:border-navy"
                >
                  Passer
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-navy py-4 text-[11px] uppercase tracking-[0.32em] text-cream transition-opacity hover:opacity-90"
                >
                  Continue
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SwipeCard({
  card,
  isTop,
  depth,
  onSwipe,
}: {
  card: Card;
  isTop: boolean;
  depth: number;
  onSwipe: (d: Choice) => void;
}) {
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) onSwipe("right");
    else if (info.offset.x < -100) onSwipe("left");
  };
  return (
    <motion.article
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.95, y: 20, opacity: 0 }}
      animate={{ scale: 1 - depth * 0.04, y: depth * -8, opacity: 1 }}
      exit={{ x: 400, opacity: 0, rotate: 12, transition: { duration: 0.3 } }}
      whileDrag={{ rotate: 0 }}
      style={{ zIndex: isTop ? 2 : 1 }}
      className="absolute inset-0 overflow-hidden border border-border bg-cream shadow-[0_30px_60px_-30px_rgba(26,42,58,0.35)]"
    >
      <div className="relative h-1/2 overflow-hidden">
        <img src={card.image} alt={card.topic} className="h-full w-full object-cover" />
      </div>
      <div className="flex h-1/2 flex-col p-6">
        <p className="text-[10px] uppercase tracking-[0.32em] text-gold">{card.topic}</p>
        <h3 className="mt-2 font-serif text-xl leading-tight text-navy">Which feels more like you?</h3>
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div className="flex items-start gap-1.5">
            <ArrowLeft className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-serif text-sm leading-tight text-navy">{card.left.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{card.left.hint}</p>
            </div>
          </div>
          <div className="flex items-start justify-end gap-1.5 text-right">
            <div>
              <p className="font-serif text-sm leading-tight text-navy">{card.right.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{card.right.hint}</p>
            </div>
            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
