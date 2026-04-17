export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export function loadGroqKeys(): string[] {
  const keys: string[] = []
  for (let i = 1; i <= 15; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]
    if (k) keys.push(k)
  }
  if (keys.length === 0 && process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY)
  return keys
}

// Основная модель — высокое качество рассуждений (шаги 3+4)
export function getGroqModel(): string {
  return process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
}

// Быстрая модель — скорость, шаги 1+2 и DA
export function getGroqFastModel(): string {
  return process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b'
}

// Актуальные модели Groq (апрель 2026):
// openai/gpt-oss-120b    ← флагман reasoning, ~475 T/s, 131K ctx  [дефолт качество]
// openai/gpt-oss-20b     ← быстрый reasoning, ~940 T/s, 131K ctx  [дефолт скорость]
// qwen/qwen3-32b         ← хороший reasoning, ~400 T/s
// llama-3.3-70b-versatile← стабильный, ~280 T/s
// llama-3.1-8b-instant   ← сверхбыстрый, лёгкий, ~560 T/s
//
// reasoning_effort: 'low' | 'medium' | 'high' — для gpt-oss и qwen3 моделей
//   low  — быстро, экономично (шаги 1+2+DA)
//   high — максимум качества (шаг 3)
//
// DEPRECATED:
// moonshotai/kimi-k2-instruct         ← deprecated 10.10.2025
// moonshotai/kimi-k2-instruct-0905    ← deprecated 15.04.2026
// meta-llama/llama-4-maverick-*       ← deprecated 20.02.2026
// deepseek-r1-distill-llama-70b       ← deprecated 02.10.2025
// qwen-qwq-32b                        ← deprecated 2025

export async function groqGenerate(
  keys: string[],
  model: string,
  prompt: string,
  maxTokens = 1024,
  temperature = 0.7,
  systemPrompt?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
): Promise<string> {
  if (keys.length === 0) throw new Error('Нет ни одного GROQ_API_KEY. Добавьте GROQ_API_KEY_1 в переменные окружения.')

  const shuffled = [...keys].sort(() => Math.random() - 0.5)
  let lastError = ''

  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

  // reasoning_effort поддерживается openai/gpt-oss-* и qwen/qwen3-* моделями
  const body: Record<string, unknown> = { model, messages, temperature, max_tokens: maxTokens, stream: false }
  if (reasoningEffort) body.reasoning_effort = reasoningEffort

  for (let i = 0; i < shuffled.length; i++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${shuffled[i]}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.ok) {
      const data = await res.json()
      return data.choices?.[0]?.message?.content ?? ''
    }
    if (res.status === 429) {
      lastError = `ключ ${i + 1}/${shuffled.length} rate limited`
      continue
    }
    throw new Error(`Groq error: ${res.status} ${await res.text()}`)
  }
  throw new Error(`Все ${shuffled.length} ключей исчерпали лимит. (${lastError})`)
}
