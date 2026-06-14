import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, Header } from "@/components/ada/AppShell";
import { Send, RefreshCw, Search } from "lucide-react";
import {
  useProfile,
  loadConversation,
  saveConversation,
  clearConversation,
  type ConversationMessage,
} from "@/lib/ada-store";
import { chatWithAda } from "@/lib/api/ada.functions";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "ADA — Chat" }] }),
  component: Chat,
});

type Msg = {
  id: number;
  from: "bot" | "user";
  text: string;
  isGreeting?: boolean;
  searchQuery?: string;
};

const GREETING_TEXT =
  "Bonjour ! Je suis ADA, ton assistante mode. Dis-moi ce que tu recherches — je vais t'aider à trouver la pièce parfaite au meilleur prix. 👀";

const CONTEXT_OPENER: ConversationMessage = {
  role: "assistant",
  content: "Bonjour ! Je suis ADA, ton assistante mode. Qu'est-ce que tu recherches aujourd'hui ?",
};

function Chat() {
  const navigate = useNavigate();
  const { profile, ready } = useProfile();

  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: "bot", text: GREETING_TEXT, isGreeting: true },
  ]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
