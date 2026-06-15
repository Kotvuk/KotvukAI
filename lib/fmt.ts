export function fmtLocal(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtPrice(value: number | string | null | undefined): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export function priceSigFigs(price: number): number {
  return price >= 1000 ? 4 : price >= 1 ? 6 : 8
}
