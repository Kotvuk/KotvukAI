const TELEGRAM_API = 'https://api.telegram.org'

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}

function getChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID || null
}

export async function sendTelegram(message: string): Promise<boolean> {
  const token  = getBotToken()
  const chatId = getChatId()
  if (!token || !chatId) return false

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(8_000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendTelegramToUser(userChatId: string, message: string): Promise<boolean> {
  const token = getBotToken()
  if (!token || !userChatId) return false

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userChatId,
        text: message,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(8_000),
    })
    return res.ok
  } catch {
    return false
  }
}
