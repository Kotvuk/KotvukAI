export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export function loadGroqKeys(): string[] {
  const keys: string[] = []
  for (let i = 1; i <= 40; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]
    if (k) keys.push(k)
  }
  if (keys.length === 0 && process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY)
  return keys
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
}

export function getGroqFastModel(): string {
  return process.env.GROQ_MODEL_FAST || 'meta-llama/llama-4-scout-17b-16e-instruct'
}

export async function groqGenerate(
  keys: string[],
  model: string,
  prompt: string,
  maxTokens = 1024,
  temperature = 0.7,
  systemPrompt?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
): Promise<string> {
  if (keys.length === 0) throw new Error('No GROQ_API_KEY found. Add GROQ_API_KEY_1 to environment variables.')

  const shuffled = [...keys].sort(() => Math.random() - 0.5)
  let lastError = ''

  const messages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]

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
    if (res.status === 429 || res.status === 401) {
      lastError = `key ${i + 1}/${shuffled.length} ${res.status === 401 ? 'unauthorized' : 'rate limited'}`
      continue
    }
    throw new Error(`Groq error: ${res.status} ${await res.text()}`)
  }
  throw new Error(`All ${shuffled.length} keys exhausted. (${lastError})`)
}
