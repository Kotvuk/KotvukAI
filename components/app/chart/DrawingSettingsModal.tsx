'use client'
import { useState, useEffect, useCallback } from 'react'

interface DrawingInfo {
  id: string
  name: string
  extendData?: unknown
  styles?: unknown
}

interface Props {
  info: DrawingInfo | null
  onClose: () => void
  onSave: (id: string, updates: { extendData?: unknown; styles?: unknown }) => void
  onDelete: (id: string) => void
}

const LINE_COLORS = [
  '#ffffff','#888888','#ff3d57','#ff6b6b','#ffa502',
  '#ffdd59','#7bed9f','#00e676','#00c8ff','#70a1ff',
  '#5352ed','#eccc68','#ff4757','#2ed573','#1e90ff',
]

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {LINE_COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 18, height: 18, borderRadius: 3, background: c, border: 'none', cursor: 'pointer',
            outline: value === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.15)',
            outlineOffset: 1,
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: 18, height: 18, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
        title="Свой цвет"
      />
    </div>
  )
}

function RectStyleEditor({
  fillColor, borderColor, borderSize,
  onChange,
}: {
  fillColor: string; borderColor: string; borderSize: number
  onChange: (patch: { fillColor?: string; borderColor?: string; borderSize?: number }) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Цвет заливки</div>
        <ColorPicker value={fillColor} onChange={c => onChange({ fillColor: c })} />
      </div>
      <div>
        <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Цвет рамки</div>
        <ColorPicker value={borderColor} onChange={c => onChange({ borderColor: c })} />
      </div>
      <div>
        <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Толщина рамки</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4].map(w => (
            <button
              key={w}
              onClick={() => onChange({ borderSize: w })}
              style={{
                width: 32, height: 28, background: borderSize === w ? 'var(--cyan)' : 'var(--bg3)',
                border: '1px solid var(--line2)', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 16, height: w, background: borderSize === w ? '#000' : 'var(--text)', borderRadius: 1 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LineStyleEditor({
  color, width, style: lineStyle,
  onChange,
}: {
  color: string; width: number; style: string
  onChange: (patch: { color?: string; width?: number; style?: string }) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Цвет</div>
        <ColorPicker value={color} onChange={c => onChange({ color: c })} />
      </div>
      <div>
        <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Толщина</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4].map(w => (
            <button
              key={w}
              onClick={() => onChange({ width: w })}
              style={{
                width: 32, height: 28, background: width === w ? 'var(--cyan)' : 'var(--bg3)',
                border: '1px solid var(--line2)', borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 16, height: w, background: width === w ? '#000' : 'var(--text)', borderRadius: 1 }} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Стиль</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'solid',  label: '——' },
            { key: 'dashed', label: '- -' },
            { key: 'dotted', label: '···' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => onChange({ style: s.key })}
              style={{
                padding: '4px 10px', background: lineStyle === s.key ? 'var(--cyan)' : 'var(--bg3)',
                border: '1px solid var(--line2)', borderRadius: 3, cursor: 'pointer',
                color: lineStyle === s.key ? '#000' : 'var(--text)', fontSize: '.65rem',
              }}
            >{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DrawingSettingsModal({ info, onClose, onSave, onDelete }: Props) {
  const [lineColor, setLineColor] = useState('#00e676')
  const [lineWidth, setLineWidth] = useState(1)
  const [lineStyle, setLineStyle] = useState('solid')
  const [rectFill, setRectFill] = useState('rgba(0,230,118,0.15)')
  const [rectBorder, setRectBorder] = useState('#00e676')
  const [rectBorderSize, setRectBorderSize] = useState(1)

  useEffect(() => {
    if (!info) return
    if (info.name === 'priceRect') {
      const st = info.styles as { polygon?: { color?: string; borderColor?: string; borderSize?: number } } | null
      setRectFill(st?.polygon?.color || 'rgba(0,230,118,0.15)')
      setRectBorder(st?.polygon?.borderColor || '#00e676')
      setRectBorderSize(st?.polygon?.borderSize || 1)
    } else {
      const st = info.styles as { line?: { color?: string; size?: number; style?: string } } | null
      setLineColor(st?.line?.color || '#00e676')
      setLineWidth(st?.line?.size || 1)
      setLineStyle(st?.line?.style || 'solid')
    }
  }, [info])

  const handleSave = useCallback(() => {
    if (!info) return
    if (info.name === 'priceRect') {
      onSave(info.id, { styles: { polygon: { color: rectFill, borderColor: rectBorder, borderSize: rectBorderSize } } })
    } else {
      onSave(info.id, { styles: { line: { color: lineColor, size: lineWidth, style: lineStyle } } })
    }
    onClose()
  }, [info, lineColor, lineWidth, lineStyle, rectFill, rectBorder, rectBorderSize, onSave, onClose])

  if (!info) return null

  const isRect = info.name === 'priceRect'
  const titleMap: Record<string, string> = {
    segment: 'Линия тренда',
    rayLine: 'Луч',
    horizontalStraightLine: 'Горизонтальная линия',
    verticalStraightLine: 'Вертикальная линия',
    priceLine: 'Ценовая линия',
    parallelStraightLine: 'Параллельный канал',
    priceChannelLine: 'Ценовой канал',
    priceRect: 'Прямоугольник',
    circle: 'Окружность',
    polygon: 'Многоугольник',
    polyline: 'Траектория',
    fibRetracement: 'Фибоначчи',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 6,
        width: 300, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--line2)',
        }}>
          <span style={{ fontSize: '.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {titleMap[info.name] || 'Настройки'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          {isRect ? (
            <RectStyleEditor
              fillColor={rectFill}
              borderColor={rectBorder}
              borderSize={rectBorderSize}
              onChange={p => {
                if (p.fillColor !== undefined) setRectFill(p.fillColor)
                if (p.borderColor !== undefined) setRectBorder(p.borderColor)
                if (p.borderSize !== undefined) setRectBorderSize(p.borderSize)
              }}
            />
          ) : (
            <LineStyleEditor
              color={lineColor}
              width={lineWidth}
              style={lineStyle}
              onChange={p => {
                if (p.color !== undefined) setLineColor(p.color)
                if (p.width !== undefined) setLineWidth(p.width)
                if (p.style !== undefined) setLineStyle(p.style)
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderTop: '1px solid var(--line2)', justifyContent: 'space-between',
        }}>
          <button
            onClick={() => { onDelete(info.id); onClose() }}
            style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--short)', color: 'var(--short)', borderRadius: 4, cursor: 'pointer', fontSize: '.65rem' }}
          >Удалить</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--line2)', color: 'var(--muted)', borderRadius: 4, cursor: 'pointer', fontSize: '.65rem' }}
            >Отмена</button>
            <button
              onClick={handleSave}
              style={{ padding: '6px 14px', background: 'var(--cyan)', border: 'none', color: '#000', borderRadius: 4, cursor: 'pointer', fontSize: '.65rem', fontWeight: 600 }}
            >Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  )
}
