"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, User, Loader2, ChevronDown, Sparkles,
  Plus, Trash2, MessageSquare, PanelLeftOpen, PanelLeftClose, Pencil, Check, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  updatedAt: string;
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

  if (ctx.tsb !== null) {
    if (ctx.tsb > 10) {
      questions.push("Estoy descansado, ¿puedo hacer una sesión de calidad hoy?");
    } else if (ctx.tsb < -20) {
      questions.push("Noto que estoy cargado, ¿cuánto descanso necesito?");
    } else {
      questions.push("¿Qué tipo de entrenamiento me recomiendas hoy?");
    }
  }

  if (ctx.weeklyLoadKm !== null) {
    if (ctx.weeklyLoadKm < 10) {
      questions.push("¿Cuánto debería correr esta semana para progresar?");
    } else {
      questions.push(`Llevo ${Math.round(ctx.weeklyLoadKm)} km esta semana, ¿continúo o reduzco?`);
    }
  }

  questions.push("¿Cómo está mi forma física ahora mismo?");
  if (!ctx.has5k) questions.push("¿Cómo puedo establecer mi primer récord en 5K?");
  if (ctx.vo2max) questions.push(`Tengo un VO2max de ${Math.round(ctx.vo2max)}, ¿cómo lo mejoro?`);
  questions.push("Dame un plan de entrenamiento para esta semana");

  return questions.slice(0, 5);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversationList = useCallback(() => {
    return fetch("/api/coach/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.conversations) setConversations(data.conversations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
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

    // Cargar lista de conversaciones y abrir la más reciente
    fetch("/api/coach/history")
      .then((r) => r.json())
      .then((data) => {
        if (data.conversations?.length) {
          setConversations(data.conversations);
          // Abrir la más reciente automáticamente
          const latest = data.conversations[0];
          return fetch(`/api/coach/history?id=${latest.id}`)
            .then((r) => r.json())
            .then((conv) => {
              if (conv.messages) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setMessages((conv.messages as any[]).filter((m) => m.role !== "system") as Message[]);
                setConversationId(conv.conversationId);
              }
            });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openConversation = useCallback((id: string) => {
    if (isStreaming) return;
    setIsLoadingHistory(true);
    setMessages([]);
    setError(null);
    fetch(`/api/coach/history?id=${id}`)
      .then((r) => r.json())
      .then((conv) => {
        if (conv.messages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMessages((conv.messages as any[]).filter((m) => m.role !== "system") as Message[]);
          setConversationId(conv.conversationId);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, [isStreaming]);

  const newConversation = useCallback(() => {
    if (isStreaming) abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setConversationId("new");
  }, [isStreaming]);

  const deleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/coach/history?id=${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (conversationId === id) {
      setMessages([]);
      setConversationId("new");
    }
  }, [conversationId]);

  const renameConversation = useCallback(async (id: string) => {
    if (!editingTitle.trim()) { setEditingId(null); return; }
    await fetch("/api/coach/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editingTitle.trim() }),
    });
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, title: editingTitle.trim() } : c)
    );
    setEditingId(null);
  }, [editingTitle]);

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

      const activeConvId = conversationId === "new" ? null : conversationId;

      try {
        const res = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            modelId: selectedModel,
            conversationId: activeConvId,
          }),
          signal: abortRef.current.signal,
        });

        const respConvId = res.headers.get("X-Conversation-Id");

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

        // Actualizar conversationId y refrescar sidebar
        if (respConvId && respConvId !== "new") {
          setConversationId(respConvId);
          // Dar tiempo a que la DB se actualice antes de refrescar
          setTimeout(() => loadConversationList(), 500);
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
    [isStreaming, selectedModel, conversationId, loadConversationList]
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

  const suggestedQuestions = buildSuggestedQuestions(ctx);
  const currentModel = models.find((m) => m.id === selectedModel);
  const isNewConversation = conversationId === "new" || conversationId === null;

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden">

      {/* ── Sidebar de conversaciones ── */}
      <div className={`transition-all duration-200 flex-shrink-0 ${sidebarOpen ? "w-64" : "w-0"} overflow-hidden`}>
        <div className="w-64 h-full flex flex-col border-r border-border/50 bg-muted/20">
          {/* Header sidebar */}
          <div className="p-3 border-b border-border/50 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium flex-1">Conversaciones</span>
            <button
              onClick={newConversation}
              className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Nueva conversación"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Lista de conversaciones */}
          <div className="flex-1 overflow-y-auto py-1">
            {conversations.length === 0 && !isLoadingHistory && (
              <p className="text-xs text-muted-foreground text-center py-6 px-3">
                Aún no hay conversaciones
              </p>
            )}
            {conversations.map((conv) => {
              const isActive = conv.id === conversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className={`group mx-1 my-0.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                    isActive
                      ? "bg-orange-500/15 border border-orange-500/25"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  {editingId === conv.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameConversation(conv.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 text-xs bg-background border border-border/60 rounded px-1.5 py-0.5 outline-none"
                      />
                      <button onClick={() => renameConversation(conv.id)} className="text-green-500 hover:text-green-400">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-1">
                        <p className="text-xs font-medium flex-1 line-clamp-2 leading-snug">
                          {conv.title}
                        </p>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditingTitle(conv.title); }}
                            className="p-0.5 rounded hover:text-foreground text-muted-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => deleteConversation(conv.id, e)}
                            className="p-0.5 rounded hover:text-destructive text-muted-foreground"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {formatDate(conv.updatedAt)} · {conv.messageCount} msgs
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Área principal del chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-2">

          {/* Toggle sidebar + header */}
          <div className="flex items-center gap-2 py-2 border-b border-border/30 mb-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              title={sidebarOpen ? "Ocultar historial" : "Ver historial"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {conversations.find((c) => c.id === conversationId)?.title ?? "Nueva conversación"}
            </span>
            <button
              onClick={newConversation}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/40 rounded-lg px-2.5 py-1.5 border border-border/40"
            >
              <Plus className="h-3 w-3" />
              Nueva
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto space-y-6 pb-4">

            {isLoadingHistory && messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

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
            </div>

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
