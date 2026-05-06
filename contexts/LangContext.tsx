'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import ru from '@/messages/ru.json'
import en from '@/messages/en.json'
import kz from '@/messages/kz.json'

type Lang = 'ru' | 'en' | 'kz'
type Translations = typeof ru

const all: Record<Lang, Translations> = { ru, en, kz }

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: keyof Translations) => string
}

const LangContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => String(en[k] ?? k),
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('kotvuk_lang') as Lang | null
    if (stored && all[stored]) setLangState(stored)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('kotvuk_lang', l)
  }

  const t = (key: keyof Translations): string => {
    const val = all[lang][key]
    return val !== undefined ? String(val) : String(ru[key] ?? key)
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
