import * as klinecharts from 'klinecharts'

export interface FibLevel {
  ratio: number
  label: string
  color: string
  show: boolean
  width: number
}

export const DEFAULT_FIB_LEVELS: FibLevel[] = [
  { ratio: 0,     label: '0',     color: '#888888', show: true,  width: 1 },
  { ratio: 0.236, label: '0.236', color: '#ff6b6b', show: true,  width: 1 },
  { ratio: 0.382, label: '0.382', color: '#ffa502', show: true,  width: 1 },
  { ratio: 0.5,   label: '0.5',   color: '#ffdd59', show: true,  width: 1 },
  { ratio: 0.618, label: '0.618', color: '#7bed9f', show: true,  width: 1 },
  { ratio: 0.786, label: '0.786', color: '#70a1ff', show: false, width: 1 },
  { ratio: 1,     label: '1',     color: '#888888', show: true,  width: 1 },
  { ratio: 1.272, label: '1.272', color: '#ff6b6b', show: false, width: 1 },
  { ratio: 1.618, label: '1.618', color: '#ff6b6b', show: false, width: 1 },
  { ratio: 2.0,   label: '2.0',   color: '#ffa502', show: false, width: 1 },
  { ratio: 2.618, label: '2.618', color: '#ffa502', show: false, width: 1 },
]

let _registered = false

export function registerFibonacciOverlay() {
  if (_registered) return
  _registered = true

  klinecharts.registerOverlay({
    name: 'fibRetracement',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,

    createPointFigures({ coordinates, bounding, overlay }: any) {
      if (coordinates.length < 2) return []

      const extData = overlay.extendData as { levels?: FibLevel[] } | null
      const levels: FibLevel[] = extData?.levels ?? DEFAULT_FIB_LEVELS

      const p1 = coordinates[0]
      const p2 = coordinates[1]
      const xLeft  = 0
      const xRight = bounding.width

      const figures: any[] = []

      const yMin = Math.min(p1.y, p2.y)
      const yMax = Math.max(p1.y, p2.y)
      figures.push({
        type: 'rect',
        attrs: { x: xLeft, y: yMin, width: xRight - xLeft, height: Math.max(yMax - yMin, 4) },
        styles: { style: 'fill', color: 'rgba(0,0,0,0.01)', borderColor: 'transparent', borderSize: 0 },
      })

      figures.push({
        type: 'line',
        attrs: { coordinates: [p1, p2] },
        styles: { color: 'rgba(255,255,255,0.25)', size: 3, style: 'dashed', dashedValue: [4, 4] },
        ignoreEvent: true,
      })

      for (const level of levels) {
        if (!level.show) continue

        const y = p1.y + (p2.y - p1.y) * level.ratio

        figures.push({
          type: 'line',
          attrs: { coordinates: [{ x: xLeft, y }, { x: xRight, y }] },
          styles: { color: level.color, size: level.width, style: 'solid' },
        })

        const pct = (level.ratio * 100).toFixed(1) + '%'
        const labelText = `${level.label}  ${pct}`
        figures.push({
          type: 'text',
          attrs: { x: xRight - 6, y: y - 2, text: labelText, align: 'right', baseline: 'bottom' },
          styles: {
            color: level.color,
            size: 10,
            family: "'Geist Mono', monospace",
          },
          ignoreEvent: true,
        })
      }

      return figures
    },

    onDoubleClick(event: unknown) {
      const ev = event as any
      window.dispatchEvent(new CustomEvent('kotvuk:overlay:dblclick', {
        detail: {
          id: ev?.overlay?.id,
          name: ev?.overlay?.name,
          extendData: ev?.overlay?.extendData,
          styles: ev?.overlay?.styles,
        }
      }))
      return true
    },

    onRightClick(event: unknown) {
      const ev = event as any
      window.dispatchEvent(new CustomEvent('kotvuk:overlay:rightclick', {
        detail: {
          id: ev?.overlay?.id,
          name: ev?.overlay?.name,
        }
      }))
      return true
    },
  })
}
