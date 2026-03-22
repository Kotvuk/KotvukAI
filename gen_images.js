/**
 * Generate images for diploma:
 * 1. DB ER Diagram (PNG)
 * 2. Architecture diagram (PNG)
 * 3. App UI mockup (PNG)
 */
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');

// ─── COLORS ─────────────────────────────────────────
const BG        = '#0d1117';
const CARD      = '#161b22';
const BORDER    = '#30363d';
const ACCENT    = '#4a9eff';
const GREEN     = '#00e676';
const RED       = '#ff3d57';
const GOLD      = '#f0a500';
const TEXT      = '#e6edf3';
const MUTED     = '#8b949e';
const HEADER_BG = '#1f2937';

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── ER DIAGRAM ──────────────────────────────────────
function drawERDiagram() {
  const W = 1200, H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ER-диаграмма базы данных KotvukAI', W / 2, 40);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 55);
  ctx.lineTo(W - 60, 55);
  ctx.stroke();

  // Table definitions
  const tables = [
    {
      name: 'users',
      color: ACCENT,
      x: 60, y: 80,
      fields: [
        { name: 'id', type: 'SERIAL', pk: true },
        { name: 'firebase_uid', type: 'TEXT', unique: true },
        { name: 'email', type: 'TEXT' },
        { name: 'nickname', type: 'TEXT' },
        { name: 'lang', type: 'TEXT' },
        { name: 'created_at', type: 'TIMESTAMPTZ' },
      ]
    },
    {
      name: 'signals',
      color: GREEN,
      x: 400, y: 80,
      fields: [
        { name: 'id', type: 'SERIAL', pk: true },
        { name: 'user_id', type: 'INTEGER', fk: true },
        { name: 'pair', type: 'TEXT' },
        { name: 'timeframe', type: 'TEXT' },
        { name: 'final_verdict', type: 'TEXT' },
        { name: 'final_confidence', type: 'INTEGER' },
        { name: 'final_entry', type: 'NUMERIC' },
        { name: 'final_tp', type: 'NUMERIC' },
        { name: 'final_sl', type: 'NUMERIC' },
        { name: 'outcome', type: 'TEXT' },
        { name: 'raw_response', type: 'JSONB' },
        { name: 'created_at', type: 'TIMESTAMPTZ' },
      ]
    },
    {
      name: 'trades',
      color: GOLD,
      x: 60, y: 440,
      fields: [
        { name: 'id', type: 'SERIAL', pk: true },
        { name: 'user_id', type: 'INTEGER', fk: true },
        { name: 'pair', type: 'TEXT' },
        { name: 'direction', type: 'TEXT' },
        { name: 'order_type', type: 'TEXT' },
        { name: 'amount', type: 'NUMERIC' },
        { name: 'entry_price', type: 'NUMERIC' },
        { name: 'tp_price', type: 'NUMERIC' },
        { name: 'sl_price', type: 'NUMERIC' },
        { name: 'status', type: 'TEXT' },
        { name: 'pnl', type: 'NUMERIC' },
        { name: 'created_at', type: 'TIMESTAMPTZ' },
      ]
    },
    {
      name: 'notifications',
      color: RED,
      x: 850, y: 80,
      fields: [
        { name: 'id', type: 'SERIAL', pk: true },
        { name: 'user_id', type: 'INTEGER', fk: true },
        { name: 'message', type: 'TEXT' },
        { name: 'read', type: 'BOOLEAN' },
        { name: 'created_at', type: 'TIMESTAMPTZ' },
      ]
    },
  ];

  const COL_W = 280, ROW_H = 26, HEADER_H = 36;

  function drawTable(t) {
    const h = HEADER_H + t.fields.length * ROW_H + 8;
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    drawRoundRect(ctx, t.x, t.y, COL_W, h, 8);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Header
    drawRoundRect(ctx, t.x, t.y, COL_W, HEADER_H, 8);
    ctx.fillStyle = t.color + '33';
    ctx.fill();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, t.x, t.y, COL_W, h, 8);
    ctx.stroke();

    // Table name
    ctx.fillStyle = t.color;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(t.name, t.x + COL_W / 2, t.y + 23);

    // Divider
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y + HEADER_H);
    ctx.lineTo(t.x + COL_W, t.y + HEADER_H);
    ctx.stroke();

    // Fields
    t.fields.forEach((f, i) => {
      const fy = t.y + HEADER_H + 4 + i * ROW_H;
      if (f.pk) {
        ctx.fillStyle = '#ffd700' + '22';
        ctx.fillRect(t.x + 2, fy + 2, COL_W - 4, ROW_H - 2);
      }
      if (f.fk) {
        ctx.fillStyle = t.color + '15';
        ctx.fillRect(t.x + 2, fy + 2, COL_W - 4, ROW_H - 2);
      }

      // Field icon
      if (f.pk) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('🔑', t.x + 8, fy + 17);
      } else if (f.fk) {
        ctx.fillStyle = t.color;
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('FK', t.x + 8, fy + 17);
      }

      ctx.fillStyle = f.pk ? '#ffd700' : (f.fk ? t.color : TEXT);
      ctx.font = f.pk ? 'bold 13px Arial' : '13px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(f.name, t.x + 28, fy + 17);

      ctx.fillStyle = MUTED;
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(f.type, t.x + COL_W - 8, fy + 17);

      // Row separator
      if (i < t.fields.length - 1) {
        ctx.strokeStyle = BORDER + '66';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(t.x + 4, fy + ROW_H);
        ctx.lineTo(t.x + COL_W - 4, fy + ROW_H);
        ctx.stroke();
      }
    });

    t._cx = t.x + COL_W / 2;
    t._cy = t.y + h / 2;
    t._right = t.x + COL_W;
    t._bottom = t.y + h;
    t._fkY = t.y + HEADER_H + 4 + 1 * ROW_H + 13;
  }

  tables.forEach(drawTable);

  // Draw FK relationships
  function drawArrow(x1, y1, x2, y2, color) {
    ctx.strokeStyle = color + '99';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    // Bezier curve
    const mx = (x1 + x2) / 2;
    ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const aLen = 10;
    ctx.fillStyle = color + '99';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - aLen * Math.cos(angle - 0.4), y2 - aLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - aLen * Math.cos(angle + 0.4), y2 - aLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    // Label "1:N"
    ctx.fillStyle = color;
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('1:N', mx, (y1 + y2) / 2 - 8);
  }

  const u = tables[0], s = tables[1], t2 = tables[2], n = tables[3];
  // users → signals
  drawArrow(u._right, u.y + 30, s.x, s._fkY, ACCENT);
  // users → trades
  drawArrow(u._cx, u._bottom, t2._cx, t2.y, ACCENT);
  // users → notifications
  drawArrow(u._right, u.y + 50, n.x, n._fkY, ACCENT);

  // Legend
  ctx.fillStyle = CARD;
  drawRoundRect(ctx, 850, 330, 290, 120, 6);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  drawRoundRect(ctx, 850, 330, 290, 120, 6);
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Легенда:', 868, 353);

  [['🔑 PK — Primary Key', '#ffd700'], ['FK — Foreign Key', ACCENT], ['─ ─ 1:N связь', MUTED]].forEach(([txt, col], i) => {
    ctx.fillStyle = col;
    ctx.font = '12px Arial';
    ctx.fillText(txt, 868, 378 + i * 22);
  });

  fs.writeFileSync('D:\\Проект 2.0\\diploma_er.png', canvas.toBuffer('image/png'));
  console.log('ER diagram saved');
}

// ─── ARCHITECTURE DIAGRAM ────────────────────────────
function drawArchDiagram() {
  const W = 1200, H = 700;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Архитектура системы KotvukAI', W / 2, 40);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 55);
  ctx.lineTo(W - 60, 55);
  ctx.stroke();

  const layers = [
    {
      label: 'БРАУЗЕР (Client)', color: '#4a9eff',
      y: 80,
      items: [
        { x: 80,  label: 'Login/Register\n(Firebase Auth)', w: 160 },
        { x: 260, label: 'Dashboard\n(React SPA)', w: 160 },
        { x: 440, label: 'KLineCharts\n(Canvas)', w: 160 },
        { x: 620, label: 'AI Panel\n(Analysis UI)', w: 160 },
        { x: 800, label: 'Settings/History\n(CRUD)', w: 160 },
        { x: 980, label: 'AuthContext\nLangContext', w: 160 },
      ]
    },
    {
      label: 'NEXT.JS SERVER (Edge + Node)', color: '#00e676',
      y: 270,
      items: [
        { x: 80,  label: 'middleware.ts\n(JWT Guard)', w: 150 },
        { x: 250, label: '/api/analyze\n(AI Pipeline)', w: 150 },
        { x: 420, label: '/api/klines\n(Binance Proxy)', w: 150 },
        { x: 590, label: '/api/trades\n/api/signals', w: 150 },
        { x: 760, label: '/api/auth/sync\n/api/settings', w: 150 },
        { x: 930, label: '/api/news\n/api/notify', w: 150 },
      ]
    },
    {
      label: 'ВНЕШНИЕ СЕРВИСЫ & БД', color: '#f0a500',
      y: 470,
      items: [
        { x: 80,  label: 'Ollama\nqwen3:1.7b', w: 160, color: '#ff6b35' },
        { x: 270, label: 'Neon\nPostgreSQL', w: 160, color: '#00adb5' },
        { x: 460, label: 'Firebase\nAuthentication', w: 160, color: '#ffca28' },
        { x: 650, label: 'Binance\nFutures API', w: 160, color: '#f0b90b' },
        { x: 840, label: 'RSS Crypto\nNews Feed', w: 160, color: '#888' },
      ]
    }
  ];

  layers.forEach(layer => {
    // Layer background
    ctx.fillStyle = layer.color + '11';
    drawRoundRect(ctx, 60, layer.y, W - 120, 160, 10);
    ctx.fill();
    ctx.strokeStyle = layer.color + '55';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, 60, layer.y, W - 120, 160, 10);
    ctx.stroke();

    // Layer label
    ctx.fillStyle = layer.color;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(layer.label, 75, layer.y + 20);

    // Items
    layer.items.forEach(item => {
      const itemColor = item.color || layer.color;
      ctx.fillStyle = itemColor + '22';
      drawRoundRect(ctx, item.x, layer.y + 30, item.w, 110, 8);
      ctx.fill();
      ctx.strokeStyle = itemColor + '88';
      ctx.lineWidth = 1.5;
      drawRoundRect(ctx, item.x, layer.y + 30, item.w, 110, 8);
      ctx.stroke();

      ctx.fillStyle = itemColor;
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      const lines = item.label.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, item.x + item.w / 2, layer.y + 30 + 55 + (i - lines.length/2 + 0.5) * 20);
      });
    });
  });

  // Arrows between layers
  function drawLayerArrow(x, y1, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrowhead
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y2);
    ctx.lineTo(x - 6, y2 - 10);
    ctx.lineTo(x + 6, y2 - 10);
    ctx.closePath();
    ctx.fill();
  }

  // Client → Server arrows
  [160, 340, 520, 700].forEach(x => {
    drawLayerArrow(x, 240, 270, MUTED);
  });
  // Server → External arrows
  [160, 340, 520, 700, 920].forEach(x => {
    drawLayerArrow(x, 430, 470, MUTED);
  });

  // HTTP labels
  ctx.fillStyle = MUTED;
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('HTTP / fetch', 240, 258);
  ctx.fillText('HTTP / SQL / REST', 340, 458);

  fs.writeFileSync('D:\\Проект 2.0\\diploma_arch.png', canvas.toBuffer('image/png'));
  console.log('Architecture diagram saved');
}

// ─── AI PIPELINE DIAGRAM ─────────────────────────────
function drawPipelineDiagram() {
  const W = 1000, H = 360;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Алгоритм AI-анализа (пайплайн)', W / 2, 36);

  const steps = [
    { x: 30,  label: 'Binance\nFutures API', sub: '200 свечей\nFunding rate', color: '#f0b90b', icon: '📊' },
    { x: 210, label: 'calcMarketData', sub: 'RSI·MACD·EMA\nS/R уровни', color: ACCENT, icon: '📐' },
    { x: 390, label: 'fullAnalysis()', sub: 'Промпт\n/no_think JSON', color: '#7c3aed', icon: '🧠' },
    { x: 570, label: 'qwen3:1.7b\n(Ollama)', sub: '4-30 сек\n~600 токенов', color: '#00e676', icon: '⚡' },
    { x: 750, label: 'saveSignal()\nNotification', sub: 'Neon PostgreSQL\nWebUI update', color: '#f0a500', icon: '💾' },
    { x: 860, label: 'Сигнал\nLONG/SHORT', sub: 'Entry·TP·SL\nConfidence%', color: '#ff3d57', icon: '🎯' },
  ];

  const BOX_W = 150, BOX_H = 200;

  steps.forEach((s, i) => {
    drawRoundRect(ctx, s.x, 70, BOX_W, BOX_H, 10);
    ctx.fillStyle = s.color + '22';
    ctx.fill();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, s.x, 70, BOX_W, BOX_H, 10);
    ctx.stroke();

    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(s.icon, s.x + BOX_W / 2, 115);

    ctx.fillStyle = s.color;
    ctx.font = 'bold 13px Arial';
    s.label.split('\n').forEach((line, j) => {
      ctx.fillText(line, s.x + BOX_W / 2, 148 + j * 18);
    });

    ctx.fillStyle = MUTED;
    ctx.font = '11px Arial';
    s.sub.split('\n').forEach((line, j) => {
      ctx.fillText(line, s.x + BOX_W / 2, 195 + j * 15);
    });

    // Arrow to next
    if (i < steps.length - 1) {
      const ax = s.x + BOX_W + 2;
      const ay = 70 + BOX_H / 2;
      const bx = steps[i + 1].x - 2;
      ctx.strokeStyle = s.color + '88';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, ay);
      ctx.stroke();
      ctx.fillStyle = s.color + '88';
      ctx.beginPath();
      ctx.moveTo(bx, ay);
      ctx.lineTo(bx - 8, ay - 5);
      ctx.lineTo(bx - 8, ay + 5);
      ctx.closePath();
      ctx.fill();
    }

    // Step label
    ctx.fillStyle = MUTED;
    ctx.font = '11px Arial';
    ctx.fillText(`Шаг ${i}`, s.x + BOX_W / 2, 295);
  });

  // Time indicator
  ctx.fillStyle = GREEN + 'cc';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('⏱  Среднее время полного цикла: ~4.4 сек (qwen3:1.7b, NVIDIA RTX 3050)', W / 2, 340);

  fs.writeFileSync('D:\\Проект 2.0\\diploma_pipeline.png', canvas.toBuffer('image/png'));
  console.log('Pipeline diagram saved');
}

// ─── RUN ALL ─────────────────────────────────────────
drawERDiagram();
drawArchDiagram();
drawPipelineDiagram();
console.log('All images generated!');
