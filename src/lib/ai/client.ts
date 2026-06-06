// Capa de abstracción de IA — soporta Groq, OpenRouter y Ollama
// Prioridad: Groq (gratis y rápido) → OpenRouter → Ollama

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  available: boolean;
  stream: (messages: ChatMessage[]) => Promise<ReadableStream<string>>;
}

// ── Groq ──────────────────────────────────────────────────────────────────────
function groqProvider(): AIProvider {
  const apiKey = process.env.GROQ_API_KEY;
  return {
    name: "groq",
    available: !!apiKey,
    stream: async (messages) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      if (!res.ok) throw new Error(`Groq error: ${res.status} ${await res.text()}`);
      return sseToTextStream(res.body!);
    },
  };
}

// ── OpenRouter ────────────────────────────────────────────────────────────────
function openRouterProvider(): AIProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return {
    name: "openrouter",
    available: !!apiKey,
    stream: async (messages) => {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
          "X-Title": "Running Copilot AI",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
      return sseToTextStream(res.body!);
    },
  };
}

// ── Ollama ────────────────────────────────────────────────────────────────────
function ollamaProvider(): AIProvider {
  const baseUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
  return {
    name: "ollama",
    available: !!process.env.OLLAMA_URL,
    stream: async (messages) => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          messages,
          stream: true,
        }),
      });
      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      // Ollama devuelve JSON lines, no SSE
      return ollamaToTextStream(res.body!);
    },
  };
}

// ── Selector automático de proveedor ─────────────────────────────────────────
export function getAIProvider(): AIProvider {
  const providers = [groqProvider(), openRouterProvider(), ollamaProvider()];
  const available = providers.find((p) => p.available);
  if (!available) {
    // Fallback: respuesta mock para desarrollo sin API keys
    return {
      name: "mock",
      available: true,
      stream: async () => {
        const msg =
          "⚠️ No hay proveedor de IA configurado. Añade GROQ_API_KEY, OPENROUTER_API_KEY u OLLAMA_URL en .env.local";
        return new ReadableStream({
          start(controller) {
            controller.enqueue(msg);
            controller.close();
          },
        });
      },
    };
  }
  return available;
}

// ── Helpers de streaming ──────────────────────────────────────────────────────

// Convierte SSE (OpenAI-compatible) a ReadableStream<string> de texto plano
function sseToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(text);
          } catch {
            // línea malformada, ignorar
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// Convierte Ollama JSON-lines a ReadableStream<string>
function ollamaToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<string> {
  const decoder = new TextDecoder();
  const reader = body.getReader();

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const text = json.message?.content;
            if (text) controller.enqueue(text);
            if (json.done) {
              controller.close();
              return;
            }
          } catch {
            // ignorar
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
