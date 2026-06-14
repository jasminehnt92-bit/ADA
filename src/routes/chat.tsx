import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell, Header } from "@/components/ada/AppShell";
import { SafeImage } from "@/components/ada/SafeImage";
import { Send, RefreshCw, Search, Tag, Plus, Check } from "lucide-react";
import {
  useProfile,
  useCart,
  loadConversation,
  saveConversation,
  clearConversation,
  imageForCategory,
  type ConversationMessage,
} from "@/lib/ada-store";
import { chatWithAda, type ChatAlternative } from "@/lib/api/ada.functions";

const chatSearchSchema = z.object({ seed: z.string().optional() });

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "ADA — Chat" }] }),
  validateSearch: chatSearchSchema,
  component: Chat,
});

type Msg = {
  id: number;
  from: "bot" | "user";
  text: string;
  isGreeting?: boolean;
  searchQuery?: string;
  alternatives?: ChatAlternative[];
};

const SUGGESTIONS = [
  "Une veste pour un mariage",
  "Des sneakers tendance",
  "Un trench beige pour la ville",
];

const GREETING_TEXT =
  "Bonjour ! Je suis ADA, ton assistante mode. Dis-moi ce que tu recherches — je vais t'aider à trouver la pièce parfaite au meilleur prix. 👀";

const CONTEXT_OPENER: ConversationMessage = {
  role: "assistant",
  content: "Bonjour ! Je suis ADA, ton assistante mode. Qu'est-ce que tu recherches aujourd'hui ?",
};

function Chat() {
  const navigate = useNavigate();
  const { seed } = useSearch({ from: "/chat" });
  const { profile, ready } = useProfile();
  const { add } = useCart();

  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: "bot", text: GREETING_TEXT, isGreeting: true },
  ]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [addedAlts, setAddedAlts] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seedSent = useRef(false);

  // Load persisted conversation on mount
  useEffect(() => {
    const stored = loadConversation();
    if (stored.length > 0) {
      const restored: Msg[] = [
        { id: 0, from: "bot", text: GREETING_TEXT, isGreeting: true },
        ...stored.map((m, i) => ({
          id: i + 1,
          from: (m.role === "user" ? "user" : "bot") as "user" | "bot",
          text: m.content,
        })),
      ];
      setMessages(restored);
      setConversation(stored);
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { mutateAsync: askAda, isPending: adaThinking } = useMutation({
    mutationFn: (msgs: ConversationMessage[]) =>
      chatWithAda({
        data: {
          messages: msgs,
          profile: {
            name: profile.name,
            age: profile.age,
            sex: profile.sex,
            hauteur: profile.hauteur,
            poitrine: profile.poitrine,
            tourTaille: profile.tourTaille,
            hanche: profile.hanche,
            longueurBuste: profile.longueurBuste,
            longueurJambe: profile.longueurJambe,
            ollamaModel: profile.ollamaModel,
            preferences: profile.preferences,
          },
        },
      }),
    onError: (err) => {
      toast.error("Erreur de connexion à ADA", {
        description: err instanceof Error ? err.message : "Réessaie dans un instant.",
      });
    },
  });

  const send = async (text: string) => {
    if (!text.trim() || adaThinking || !ready) return;

    const userMsg: Msg = { id: Date.now(), from: "user", text };
    const userConvMsg: ConversationMessage = { role: "user", content: text };

    // Build history: include context opener + prior exchanges + this message
    const historyForClaude: ConversationMessage[] = [
      CONTEXT_OPENER,
      ...conversation,
      userConvMsg,
    ];

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const result = await askAda(historyForClaude);

    const botMsg: Msg = {
      id: Date.now() + 1,
      from: "bot",
      text: result.text,
      searchQuery: result.searchQuery ?? undefined,
      alternatives: result.alternatives?.length ? result.alternatives : undefined,
    };

    const newConversation: ConversationMessage[] = [
      ...conversation,
      userConvMsg,
      { role: "assistant", content: result.text },
    ];

    setMessages((prev) => [...prev, botMsg]);
    setConversation(newConversation);
    saveConversation(newConversation);
  };

  // Master prompt from a moodboard image → auto-send it once the profile is ready,
  // unless a conversation is already in progress.
  useEffect(() => {
    if (!seed || seedSent.current || !ready) return;
    if (loadConversation().length > 0) return;
    seedSent.current = true;
    send(seed);
    // strip the seed from the URL so a refresh doesn't replay it
    navigate({ to: "/chat", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, ready]);

  const addAlt = (alt: ChatAlternative) => {
    add({
      name: alt.title,
      brand: "Vinted",
      price: alt.price,
      originalPrice: alt.price,
      image: alt.image ?? imageForCategory(),
      source: "vinted",
      link: alt.url,
    });
    setAddedAlts((prev) => ({ ...prev, [alt.id]: true }));
  };

  const handleYesSearch = (query: string) => {
    navigate({ to: "/analysis", search: { q: query } });
  };

  const handleNoSearch = () => {
    send("Non, j'aimerais affiner encore ma recherche.");
  };

  const handleReset = () => {
    clearConversation();
    setConversation([]);
    setMessages([{ id: 0, from: "bot", text: GREETING_TEXT, isGreeting: true }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between px-6 pt-10 pb-2">
        <Header eyebrow="Conversation" title="ADA, ton assistante." />
        <button
          onClick={handleReset}
          className="mt-6 flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition hover:text-navy"
          aria-label="Nouvelle conversation"
        >
          <RefreshCw className="h-3 w-3" />
          Nouveau
        </button>
      </div>

      <div className="px-6">
        <div className="space-y-4 pb-6">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] ${m.from === "user" ? "" : "flex gap-3"}`}>
                  {m.from === "bot" && (
                    <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center border border-border bg-cream font-serif text-[11px] text-navy">
                      A
                    </div>
                  )}
                  <div>
                    <div
                      className={`px-4 py-3 text-sm leading-relaxed ${
                        m.from === "user"
                          ? "bg-navy text-cream"
                          : "border border-border bg-cream text-navy"
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* Search proposal YES/NO */}
                    {m.searchQuery && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleYesSearch(m.searchQuery!)}
                          className="flex items-center gap-1.5 bg-navy px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-cream transition hover:opacity-90"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Oui, cherche !
                        </button>
                        <button
                          onClick={handleNoSearch}
                          className="border border-border bg-cream px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-navy transition hover:border-navy"
                        >
                          Non, affine
                        </button>
                      </div>
                    )}

                    {/* Inline real Vinted listings when ADA concludes */}
                    {m.alternatives && m.alternatives.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                          <Tag className="h-3 w-3 text-gold" />
                          {m.alternatives.length} trouvaille{m.alternatives.length > 1 ? "s" : ""} sur Vinted
                        </p>
                        {m.alternatives.map((alt) => (
                          <div
                            key={alt.id}
                            className="flex items-center gap-3 border border-border bg-cream p-2"
                          >
                            <div className="h-12 w-12 shrink-0 overflow-hidden bg-muted">
                              <SafeImage
                                src={alt.image ?? imageForCategory()}
                                alt={alt.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-navy">{alt.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {alt.condition ? `${alt.condition} · ` : ""}
                                <span className="font-serif text-navy">{alt.price.toFixed(2)}€</span>
                              </p>
                            </div>
                            <a
                              href={alt.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-navy underline-offset-4 hover:underline"
                            >
                              Voir
                            </a>
                            <button
                              type="button"
                              onClick={() => addAlt(alt)}
                              disabled={addedAlts[alt.id]}
                              aria-label="Ajouter au Super-Panier"
                              className="grid h-8 w-8 shrink-0 place-items-center bg-navy text-cream transition hover:opacity-90 disabled:bg-gold"
                            >
                              {addedAlts[alt.id] ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            {adaThinking && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex gap-3">
                  <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center border border-border bg-cream font-serif text-[11px] text-navy">
                    A
                  </div>
                  <div className="border border-border bg-cream px-5 py-3 text-navy">
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggestion chips (first message only) */}
          {messages.length === 1 && !adaThinking && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Essaie :</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="border border-border bg-cream px-3 py-1.5 text-xs text-navy transition hover:border-navy"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="sticky bottom-24 flex items-center border border-border bg-cream p-1 focus-within:border-navy"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={adaThinking ? "ADA réfléchit…" : "Réponds à ADA…"}
            disabled={adaThinking}
            className="flex-1 bg-transparent px-4 py-3 text-sm text-navy placeholder:text-muted-foreground outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={adaThinking || !input.trim()}
            className="grid h-10 w-10 place-items-center bg-navy text-cream transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
