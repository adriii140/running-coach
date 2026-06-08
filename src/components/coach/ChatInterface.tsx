"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RotateCcw, ChevronDown, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
}

interface CoachContext {
  tsb: number | null;
  weeklyLoadKm: number | null;
  vo2max: number | null;
  has5k: boolean;
  nextRace: {
    name: string;
    daysUntil: number | null;
    distanceKm: number | null;
    isPrimary: boolean;
  } | null;
}

function buildSuggestedQuestions(ctx: CoachContext | null): string[] {
  if (!ctx) return [
    "¿Cómo está mi forma física ahora mismo?",
    "¿Qué ritmo debería usar para mis rodajes fáciles?",
    "¿Cuánto debería correr esta semana?",
    "¿Cómo puedo mejorar mi VO2max?",
  ];

  const questions: string[] = [];

  // Preguntas sobre la carrera próxima
  if (ctx.nextRace) {
    const { name, daysUntil, distanceKm } = ctx.nextRace;
    if (daysUntil !== null && daysUntil <= 10) {
      questions.push(`Tengo ${name} en ${daysUntil} días, ¿qué hago esta semana?`);
      questions.push(`¿Debo hacer tapering antes de ${name}?`);
    } else if (daysUntil !== null && daysUntil <= 30) {
      questions.push(`¿Cómo enfoco las próximas semanas antes de ${name}?`);
      questions.push(distanceKm
        ? `Dame un plan para preparar los ${distanceKm} km de ${name}`
        : `Dame un plan de las últimas semanas antes de ${name}`);
    } else if (daysUntil !== null) {
      questions.push(`Tengo ${name} en ${daysUntil} días, ¿cómo planifico el entrenamiento?`);
    }
  }

  // Preguntas según TSB (forma)
  if (ctx.tsb !== null) {
    if (ctx.tsb > 10) {
      questions.push("Estoy descansado, ¿puedo hacer una sesión de calidad hoy?");
    } else if (ctx.tsb < -20) {
      questions.push("Noto que estoy cargado, ¿cuánto descanso necesito?");
    } else {
      questions.push("¿Qué tipo de entrenamiento me recomiendas hoy?");
    }
  }

  // Preguntas según carga semanal
  if (ctx.weeklyLoadKm !== null) {
    if (ctx.weeklyLoadKm < 10) {
      questions.push("¿Cuánto debería correr esta semana para progresar?");
    } else {
      questions.push(`Llevo ${Math.round(ctx.weeklyLoadKm)} km esta semana, ¿continúo o reduzco?`);
    }
  }

  // Preguntas generales de calidad
  questions.push("¿Cómo está mi forma física ahora mismo?");
  if (!ctx.has5k) questions.push("¿Cómo puedo establecer mi primer récord en 5K?");
  if (ctx.vo2max) questions.push(`Tengo un VO2max de ${Math.round(ctx.vo2max)}, ¿cómo lo mejoro?`);
  questions.push("Dame un plan de entrenamiento para esta semana");

  return questions.slice(0, 5);
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [ctx, setCtx] = useState<CoachContext | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cargar modelos y contexto en paralelo
    fetch("/api/coach/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length) {
          setModels(data.models);
          setSelectedModel(data.defaultModelId);
        }
      })
      .catch(() => {});

    fetch("/api/coach/context")
      .then((r) => r.json())
      .then(setCtx)
      .catch(() => {});

    // Cargar historial de la conversación activa
    fetch("/api/coach/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMessages((data.messages as any[]).filter((m) => m.role !== "system") as Message[]);
          setConversationId(data.conversationId ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;
      setError(null);

      const userMessage: Message = { role: "user", content: content.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      setIsStreaming(true);
      abortRef.current = new AbortController();
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            modelId: selectedModel,
            conversationId: conversationId,
          }),
          signal: abortRef.current.signal,
        });

        // Capturar el conversationId de la respuesta para futuras peticiones
        const respConvId = res.headers.get("X-Conversation-Id");
        if (respConvId && respConvId !== "new") {
          setConversationId(respConvId);
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Error desconocido" }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: accumulated };
            return updated;
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Error al conectar con el Coach");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, selectedModel, conversationId]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setConversationId(null);
    // Borrar historial en la base de datos
    fetch("/api/coach/history", { method: "DELETE" }).catch(() => {});
  };

  const suggestedQuestions = buildSuggestedQuestions(ctx);
  const currentModel = models.find((m) => m.id === selectedModel);

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">

        {/* Cargando historial */}
        {isLoadingHistory && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Estado vacío */}
        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-2">
            <div className="rounded-2xl bg-orange-500/10 border border-orange-500/20 p-4">
              <Bot className="h-8 w-8 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Coach AI</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Tengo acceso a todos tus datos: actividades, forma física, carreras y objetivos.
              </p>
            </div>

            {/* Preguntas dinámicas */}
            <div className="w-full max-w-md space-y-2">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" /> Sugerencias para ti
              </p>
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-sm text-left px-4 py-2.5 rounded-xl border border-border/50 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-muted-foreground hover:text-foreground active:scale-[0.98]"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Info de carrera próxima */}
            {ctx?.nextRace && (
              <div className="w-full max-w-md rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-left">
                <p className="text-xs text-orange-400 font-medium mb-1">Próxima carrera</p>
                <p className="text-sm font-semibold">{ctx.nextRace.name}</p>
                <p className="text-xs text-muted-foreground">
                  En {ctx.nextRace.daysUntil} días
                  {ctx.nextRace.distanceKm ? ` · ${ctx.nextRace.distanceKm} km` : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mensajes */}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            isLast={i === messages.length - 1}
            isStreaming={isStreaming}
          />
        ))}

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 pt-3 space-y-2">
        {/* Controles superiores */}
        <div className="flex items-center justify-between">
          {models.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowModelPicker((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/40 rounded-lg px-2.5 py-1.5 border border-border/40"
              >
                <Bot className="h-3 w-3" />
                <span>{currentModel?.label ?? "Modelo"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full mb-2 left-0 w-72 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-10">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0 ${m.id === selectedModel ? "bg-orange-500/10 text-orange-400" : ""}`}
                    >
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <RotateCcw className="h-3 w-3" />
              Nueva conversación
            </button>
          )}
        </div>

        {/* Textarea + enviar */}
        <div className="relative flex items-end gap-2 bg-muted/30 border border-border/60 rounded-xl px-4 py-3 focus-within:border-orange-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta sobre tu entrenamiento, pide un plan, analiza tu forma..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground/50 max-h-40 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 rounded-lg bg-orange-500 p-2 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isStreaming
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground/40 text-center">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message, isLast, isStreaming,
}: {
  message: Message;
  isLast: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const isEmpty = !message.content && isLast && isStreaming;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`shrink-0 rounded-xl h-8 w-8 flex items-center justify-center text-sm font-bold ${
        isUser ? "bg-orange-500 text-white" : "bg-muted border border-border/50"
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`max-w-[85%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
        isUser
          ? "bg-orange-500 text-white rounded-tr-sm"
          : "bg-card border border-border/40 rounded-tl-sm"
      }`}>
        {isEmpty ? (
          <span className="flex gap-1 items-center h-5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
            prose-p:my-2 prose-p:text-foreground prose-p:leading-relaxed
            prose-strong:text-foreground prose-strong:font-semibold
            prose-ul:my-2 prose-ul:pl-5 prose-li:my-1 prose-li:text-foreground prose-li:leading-relaxed
            prose-ol:my-2 prose-ol:pl-5
            prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-orange-400 prose-code:text-xs
            prose-hr:border-border/40 prose-hr:my-3">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
