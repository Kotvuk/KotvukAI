export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { sql, updateUserWatchlist, getUserWatchlist, updateAutoAnalyzePaused, type User } from '@/lib/db'
import { DEFAULT_WATCHLIST } from '@/lib/pairs'

interface TgMessage {
  text?: string
  chat?: { id?: string | number }
}

const TG_API = 'https://api.telegram.org'

async function reply(chatId: string | number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(8_000),
    })
  } catch {}
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' })
  }

  const message = (body?.message || body?.edited_message) as TgMessage | undefined
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId  = String(message.chat?.id)
  const rawText = String(message.text).trim()

  const adminChatId = process.env.TELEGRAM_CHAT_ID
  if (!adminChatId || chatId !== String(adminChatId)) {
    await reply(chatId, '⛔ Доступ запрещён.')
    return NextResponse.json({ ok: true })
  }

  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
  if (!adminEmail) return NextResponse.json({ ok: false, error: 'ADMIN_EMAILS not set' })

  const users = await sql`SELECT * FROM users WHERE email = ${adminEmail} LIMIT 1`
  if (!users.length) {
    await reply(chatId, '❌ Администратор не найден в БД. Зарегистрируйтесь на сайте.')
    return NextResponse.json({ ok: true })
  }
  const user   = users[0] as User
  const userId = Number(user.id)
  const isPaused = Boolean(user.auto_analyze_paused)

  const userWatchlist = await getUserWatchlist(userId)
  const current: string[] = userWatchlist?.length ? userWatchlist : DEFAULT_WATCHLIST

  const parts = rawText.split(/\s+/)
  const cmd   = parts[0].toLowerCase().replace('@' + (process.env.TELEGRAM_BOT_USERNAME || ''), '')
  const arg   = parts[1]?.toUpperCase().replace('/', '').trim()

  switch (cmd) {
    case '/start':
    case '/help': {
      const txt = '🤖 <b>KotvukAI — Авто-Анализ</b>\n\n'
        + 'Команды:\n'
        + '/status — текущий статус\n'
        + '/pairs — список отслеживаемых пар\n'
        + '/addpair BTCUSDT — добавить пару\n'
        + '/removepair BTCUSDT — убрать пару\n'
        + '/setdefault — сбросить к топ-15\n'
        + '/stop — ⏸ приостановить авто-анализ\n'
        + '/resume — ▶️ возобновить авто-анализ\n\n'
        + 'Авто-анализ запускается каждые 5 минут.\n'
        + 'Таймфреймы: 5m / 15m / 1h / 4h\n'
        + `Статус: ${isPaused ? '⏸ Приостановлен' : '✅ Активен'}`
      await reply(chatId, txt)
      break
    }

    case '/stop': {
      if (isPaused) {
        await reply(chatId, 'ℹ️ Авто-анализ уже приостановлен. Используй /resume для запуска.')
        break
      }
      await updateAutoAnalyzePaused(userId, true)
      await reply(
        chatId,
        '⏸ <b>Авто-анализ приостановлен.</b>\n\n'
        + `Пары (${current.length}) сохранены.\n`
        + 'Используй /resume чтобы возобновить.',
      )
      break
    }

    case '/resume': {
      if (!isPaused) {
        await reply(chatId, 'ℹ️ Авто-анализ уже активен. Используй /stop для паузы.')
        break
      }
      await updateAutoAnalyzePaused(userId, false)
      await reply(
        chatId,
        '▶️ <b>Авто-анализ возобновлён!</b>\n\n'
        + `Отслеживается ${current.length} пар.\n`
        + 'Следующий запуск — через несколько минут (каждые 5 минут).',
      )
      break
    }

    case '/pairs': {
      const statusIcon = isPaused ? '⏸' : '✅'
      const list = current.map((p, i) => `${i + 1}. ${p}`).join('\n')
      await reply(chatId, `${statusIcon} <b>Отслеживаемые пары (${current.length}):</b>\n\n${list}`)
      break
    }

    case '/addpair': {
      if (!arg) {
        await reply(chatId, '⚠️ Укажите пару: /addpair BTCUSDT')
        break
      }
      if (current.includes(arg)) {
        await reply(chatId, `ℹ️ ${arg} уже в списке (${current.length} пар)`)
        break
      }
      if (current.length >= 30) {
        await reply(chatId, '⚠️ Максимум 30 пар. Сначала удалите лишние через /removepair')
        break
      }
      const newList = [...current, arg]
      await updateUserWatchlist(userId, newList)
      await reply(chatId, `✅ ${arg} добавлен. Всего: ${newList.length} пар`)
      break
    }

    case '/removepair': {
      if (!arg) {
        await reply(chatId, '⚠️ Укажите пару: /removepair BTCUSDT')
        break
      }
      const newList = current.filter(p => p !== arg)
      if (newList.length === current.length) {
        await reply(chatId, `ℹ️ ${arg} не найден в списке`)
        break
      }
      await updateUserWatchlist(userId, newList)
      await reply(chatId, `✅ ${arg} удалён. Осталось: ${newList.length} пар`)
      break
    }

    case '/setdefault': {
      await updateUserWatchlist(userId, DEFAULT_WATCHLIST)
      const list = DEFAULT_WATCHLIST.map((p, i) => `${i + 1}. ${p}`).join('\n')
      await reply(chatId, `✅ Список сброшен к топ-15:\n\n${list}`)
      break
    }

    case '/status': {
      const appUrl  = process.env.NEXT_PUBLIC_APP_URL || '(URL не задан)'
      const batches = Math.ceil(current.length / 5)
      const statusLine = isPaused
        ? '⏸ <b>ПРИОСТАНОВЛЕН</b> (используй /resume)'
        : '✅ <b>АКТИВЕН</b> (используй /stop для паузы)'
      await reply(
        chatId,
        `📡 <b>Статус авто-анализа</b>\n\n`
        + `${statusLine}\n\n`
        + `Пар: ${current.length} (${batches} батч${batches === 1 ? '' : batches < 5 ? 'а' : 'ей'})\n`
        + `Расписание: каждые 5 мин | TF: 5m / 15m / 1h / 4h\n`
        + `Сервер: ${appUrl}\n\n`
        + `Уведомления приходят при сигнале LONG или SHORT.\n`
        + `TP/SL исходы проверяются каждые 5 минут.`,
      )
      break
    }

    default: {
      await reply(chatId, '❓ Неизвестная команда. Введите /help')
    }
  }

  return NextResponse.json({ ok: true })
}
