import OpenAI from "openai";

/**
 * Cliente OpenAI configurado para se comunicar com o Ollama local
 * Modelo sugerido: qwen2.5:3b ou qwen2.5-coder:3b
 */
export const qwenClient = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  apiKey: process.env.OLLAMA_API_KEY || "ollama",
});

export default qwenClient;
