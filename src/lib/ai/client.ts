// Capa de abstracción de IA — proveedores gratuitos
// Groq (primario) → Google Gemini → OpenRouter

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
}

export const FREE_MODELS: ModelOption[] = [
  // Groq — ultrarrápido, gratuito
  { id: "groq:llama-3.3-70b-versatile",    provider: "groq",       label: "Llama 3.3 70B",         description: "Groq · Mejor calidad · Rápido" },
  { id: "groq:llama-3.1-8b-instant",        provider: "groq",       label: "Llama 3.1 8B Instant",  description: "Groq · Más rápido · Respuestas cortas" },
  { id: "groq:gemma2-9b-it",                provider: "groq",       label: "Gemma 2 9B",            description: "Groq · Google · Equilibrado" },
  { id: "groq:mixtral-8x7b-32768",          provider: "groq",       label: "Mixtral 8x7B",          description: "Groq · Contexto largo" },
  // Google Gemini — gratuito con API key
  { id: "gemini:gemini-2.0-flash",          provider: "gemini",     label: "Gemini 2.0 Flash",      description: "Google · Muy rápido · Gratis" },
  { id: "gemini:gemini-1.5-flash",          provider: "gemini",     label: "Gemini 1.5 Flash",      description: "Google · Contexto 1M tokens · Gratis" },
  // OpenRouter — modelos gratuitos
  { id: "openrouter:meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", label: "Llama 3.3 70B (OR)", description: "OpenRouter · Gratis" },
  { id: "openrouter:google/gemma-3-27b-it:free",             provider: "openrouter", label: "Gemma 3 27B (OR)",   description: "OpenRouter · Google · Gratis" },
  { id: "openrouter:mistralai/mistral-7b-instruct:free",     provider: "openrouter", label: "Mistral 7B (OR)",    description: "OpenRouter · Ligero · Gratis" },
];

export const DEFAULT_MODEL_ID = "groq:llama-3.3-70b-versatile";

// ── Stream desde un modelo concreto ──────────────────────────────────────────
export async function streamFromModel(
  modelId: string,
  messages: ChatMessage[]
): Promise<{ stream: ReadableStream<string>; modelUsed: string; provider: string }> {
  const [provider, model] = modelId.split(/:(.+)/); // split en primer ":"

  switch (provider) {
    case "groq":
      return { stream: await groqStream(model, messages), modelUsed: model, provider: "groq" };
    case "gemini":
      return { stream: await geminiStream(model, messages), modelUsed: model, provider: "gemini" };
    case "openrouter":
      return { stream: await openRouterStream(model, messages), modelUsed: model, provider: "openrouter" };
    default:
      throw new Error(`Proveedor desconocido: ${provider}`);
  }
}

// Devuelve el primer modelo disponible según las API keys configuradas
export function getDefaultModelId(): string {
  if (process.env.GROQ_API_KEY)         return DEFAULT_MODEL_ID;
  if (process.env.GEMINI_API_KEY)        return "gemini:gemini-2.0-flash";
  if (process.env.OPENROUTER_API_KEY)    return "openrouter:meta-llama/llama-3.3-70b-instruct:free";
  return DEFAULT_MODEL_ID; // fallback — fallará con mensaje claro
}

export function getAvailableModels(): ModelOption[] {
  return FREE_MODELS.filter((m) => {
    if (m.provider === "groq")       return !!process.env.GROQ_API_KEY;
    if (m.provider === "gemini")     return !!process.env.GEMINI_API_KEY;
    if (m.provider === "openrouter") return !!process.env.OPENROUTER_API_KEY;
    return false;
  });
}

// ── Groq ──────────────────────────────────────────────────────────────────────
async function groqStream(model: string, messages: ChatMessage[]): Promise<ReadableStream<string>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY no configurada");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: 1024 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  return sseToTextStream(res.body!);
}

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function geminiStream(model: string, messages: ChatMessage[]): Promise<ReadableStream<string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  // Convertir formato OpenAI → Gemini
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMsgs = messages.filter((m) => m.role !== "system");

  const contents = chatMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }
  body.generationConfig = { maxOutputTokens: 1024, temperature: 0.7 };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  return geminiSseToTextStream(res.body!);
}

// ── OpenRouter ────────────────────────────────────────────────────────────────
async function openRouterStream(model: string, messages: ChatMessage[]): Promise<ReadableStream<string>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY no configurada");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "Running Copilot AI",
    },
    body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: 1024 }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return sseToTextStream(res.body!);
}

// ── Helpers de streaming ──────────────────────────────────────────────────────

function sseToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { controller.close(); return; }
          try {
            const text = JSON.parse(data).choices?.[0]?.delta?.content;
            if (text) controller.enqueue(text);
          } catch { /* ignorar */ }
        }
      }
    },
    cancel() { reader.cancel(); },
  });
}

function geminiSseToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) controller.enqueue(text);
          } catch { /* ignorar */ }
        }
      }
    },
    cancel() { reader.cancel(); },
  });
}
