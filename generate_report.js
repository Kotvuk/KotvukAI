const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = require('C:/Users/admin/AppData/Roaming/npm/node_modules/docx');

// ── Helpers ──────────────────────────────────────────────────────────────────

const FONT = 'Times New Roman';
const MONO = 'Courier New';

// DXA units: 1 inch = 1440, 1 cm = 567
// Margins: left 3cm=1701, right 1.5cm=851, top/bottom 2cm=1134
const PAGE = { width: 11906, height: 16838 }; // A4
const MARGINS = { left: 1701, right: 851, top: 1134, bottom: 1134 };
const CONTENT_W = PAGE.width - MARGINS.left - MARGINS.right; // ~9354

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 0, after: 240 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, font: FONT, size: 28, bold: true })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true })]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: 360, before: 0, after: 120 },
    indent: { firstLine: 720 },
    children: [new TextRun({ text, font: FONT, size: 28, ...opts })]
  });
}

function pNoIndent(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.BOTH,
    spacing: { line: 360, before: 0, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 28, ...opts })]
  });
}

function pCenter(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, before: 120, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 28, ...opts })]
  });
}

function blank(n = 1) {
  return Array(n).fill(null).map(() => new Paragraph({
    spacing: { line: 360 },
    children: [new TextRun({ text: '', size: 28 })]
  }));
}

function code(text) {
  return new Paragraph({
    spacing: { line: 240, before: 60, after: 60 },
    indent: { left: 720 },
    children: [new TextRun({ text, font: MONO, size: 18, color: '1a1a1a' })]
  });
}

function bullet(text, lvl = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: lvl },
    spacing: { line: 360, before: 0, after: 80 },
    children: [new TextRun({ text, font: FONT, size: 28 })]
  });
}

function numbered(text, lvl = 0) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: lvl },
    spacing: { line: 360, before: 0, after: 80 },
    children: [new TextRun({ text, font: FONT, size: 28 })]
  });
}

const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 4, color: '2E75B6' };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((txt, i) => new TableCell({
      borders: isHeader ? headerBorders : borders,
      shading: isHeader ? { fill: '2E75B6', type: ShadingType.CLEAR } : (i % 2 === 0 ? { fill: 'F5F5F5', type: ShadingType.CLEAR } : undefined),
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: txt, font: FONT, size: 22, bold: isHeader, color: isHeader ? 'FFFFFF' : '000000' })]
      })]
    }))
  });
}

function makeTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      tableRow(headers, true),
      ...rows.map(r => new TableRow({
        children: r.map((txt, i) => new TableCell({
          borders,
          width: { size: colWidths[i], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: txt, font: FONT, size: 22 })]
          })]
        }))
      }))
    ]
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 24, italics: true })]
  });
}

function sectionTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, allCaps: true })]
  });
}

// ── DOCUMENT ─────────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '-',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }, {
          level: 1, format: LevelFormat.BULLET, text: 'o',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } }
        }]
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  styles: {
    default: {
      document: { run: { font: FONT, size: 28 } }
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
        quickFormat: true,
        run: { font: FONT, size: 32, bold: true, color: '000000' },
        paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
        quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: '000000' },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
        quickFormat: true,
        run: { font: FONT, size: 26, bold: true, color: '000000' },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [
    // ═══════════════════════════════════════════════════════════════
    // ТИТУЛЬНЫЙ ЛИСТ
    // ═══════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: PAGE.width, height: PAGE.height },
          margin: MARGINS
        }
      },
      children: [
        ...blank(2),
        pCenter('МИНИСТЕРСТВО ОБРАЗОВАНИЯ И НАУКИ РЕСПУБЛИКИ КАЗАХСТАН', { bold: true, size: 22 }),
        pCenter('Кафедра информационных технологий и программирования', { size: 22 }),
        ...blank(4),
        pCenter('ДИПЛОМНАЯ РАБОТА', { bold: true, size: 36, allCaps: true }),
        ...blank(1),
        pCenter('на тему:', { size: 28 }),
        ...blank(1),
        pCenter('«Разработка веб-приложения для интеллектуального анализа', { bold: true, size: 30 }),
        pCenter('криптовалютных рынков на основе локальных ИИ-моделей»', { bold: true, size: 30 }),
        ...blank(5),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { line: 360, after: 120 },
          children: [new TextRun({ text: 'Выполнил: студент группы ИТ-21', font: FONT, size: 28 })]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { line: 360, after: 120 },
          children: [new TextRun({ text: 'Проверил: к.т.н., доцент', font: FONT, size: 28 })]
        }),
        ...blank(6),
        pCenter('2026 год', { bold: true, size: 28 })
      ]
    },
    // ═══════════════════════════════════════════════════════════════
    // АННОТАЦИЯ
    // ═══════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: PAGE.width, height: PAGE.height },
          margin: MARGINS
        }
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })]
          })]
        })
      },
      children: [
        sectionTitle('АННОТАЦИЯ'),
        p('Дипломная работа посвящена разработке полнофункционального веб-приложения KotvukAI — платформы для автоматического технического анализа криптовалютных рынков с применением локальных моделей искусственного интеллекта. Система интегрирует трёхступенчатый AI-пайплайн на базе языковых моделей Ollama (qwen3:8b для текстового анализа, qwen3-vl:8b для визуального анализа графиков), данные биржи Binance Futures в реальном времени, облачную базу данных Neon PostgreSQL и аутентификацию Firebase.'),
        p('Основная концепция проекта — предоставить трейдерам инструмент для получения торговых сигналов без зависимости от платных облачных AI-сервисов. Пользователь может выбрать любую из 30 криптовалютных пар и 7 таймфреймов, после чего система последовательно выполняет технический анализ, риск-менеджмент и итоговый синтез сигнала с указанием точки входа, тейк-профита и стоп-лосса.'),
        p('В ходе работы были реализованы следующие программные модули: свечной график с отображением уровней AI-сигнала (KLineCharts v9), трейдинг-журнал с расчётом PnL, RSS-лента криптоновостей с сентимент-анализом, система уведомлений и история сигналов. Интерфейс поддерживает три языка — русский, английский и казахский.'),
        p('В процессе тестирования было выявлено и устранено пять критических дефектов: ошибка инициализации Proxy-объекта базы данных, некорректная загрузка библиотеки графиков через CDN, сбой парсинга JSON из-за thinking-блоков модели qwen3, отсутствие расчёта PnL при закрытии позиций, а также нефункциональная форма смены пароля.'),
        p('Приложение разработано на стеке Next.js 14 + React 18 + TypeScript 5, развёртывается локально и не требует подключения к платным API. Все исходные коды структурированы согласно принципам модульной архитектуры и покрыты статической типизацией TypeScript.'),
        ...blank(1),
        p('Ключевые слова: криптовалюта, технический анализ, искусственный интеллект, локальные языковые модели, Ollama, Next.js, Binance Futures, торговые сигналы, веб-приложение.', { italics: true }),
        ...blank(2),
        sectionTitle('ANNOTATION'),
        p('This thesis is devoted to the development of a full-featured web application KotvukAI — a platform for automated technical analysis of cryptocurrency markets using local artificial intelligence models. The system integrates a three-stage AI pipeline based on Ollama language models (qwen3:8b for text analysis, qwen3-vl:8b for visual chart analysis), real-time Binance Futures data, Neon PostgreSQL cloud database, and Firebase authentication.'),
        p('The main concept of the project is to provide traders with a tool for obtaining trading signals without depending on paid cloud AI services. The user can select any of 30 cryptocurrency pairs and 7 timeframes, after which the system sequentially performs technical analysis, risk management, and final signal synthesis with entry point, take-profit, and stop-loss levels.'),
        p('Keywords: cryptocurrency, technical analysis, artificial intelligence, local language models, Ollama, Next.js, Binance Futures, trading signals, web application.', { italics: true }),
      ]
    },
    // ═══════════════════════════════════════════════════════════════
    // СОДЕРЖАНИЕ
    // ═══════════════════════════════════════════════════════════════
    {
      properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: MARGINS } },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] })] })
      },
      children: [
        sectionTitle('СОДЕРЖАНИЕ'),
        new TableOfContents('Содержание', {
          hyperlink: true,
          headingStyleRange: '1-3',
          stylesWithLevels: [
            { styleName: 'Heading1', level: 1 },
            { styleName: 'Heading2', level: 2 },
            { styleName: 'Heading3', level: 3 }
          ]
        })
      ]
    },
    // ═══════════════════════════════════════════════════════════════
    // ГЛАВА 1 — ВВЕДЕНИЕ
    // ═══════════════════════════════════════════════════════════════
    {
      properties: { page: { size: { width: PAGE.width, height: PAGE.height }, margin: MARGINS } },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] })] })
      },
      children: [
        h1('ГЛАВА 1. ВВЕДЕНИЕ'),
        h2('1.1 Актуальность темы'),
        p('Криптовалютный рынок за последнее десятилетие превратился из нишевого явления в глобальный финансовый феномен. По данным CoinMarketCap, суммарная капитализация криптовалютного рынка по состоянию на начало 2026 года превышает 3 триллиона долларов США. Ежедневный объём торгов на ведущих биржах, таких как Binance, превышает 50 миллиардов долларов, а число активных трейдеров исчисляется десятками миллионов человек по всему миру.'),
        p('В условиях высокой волатильности крипторынка (суточные колебания цены биткоина в 5–15% являются нормой) трейдеры испытывают острую потребность в инструментах для быстрого и точного анализа рыночных данных. Традиционные методы технического анализа — RSI, MACD, EMA, уровни поддержки и сопротивления — требуют значительного времени и экспертизы для интерпретации в совокупности.'),
        p('Параллельно с ростом криптовалютного рынка произошла революция в области больших языковых моделей (LLM). Модели класса GPT-4, Claude 3, Gemini Ultra демонстрируют впечатляющие возможности в анализе данных и генерации экспертных рекомендаций. Однако их использование через облачные API сопряжено с рядом существенных ограничений:'),
        bullet('Высокая стоимость — использование GPT-4 Turbo обходится в $10–30 за 1 миллион токенов, что при интенсивном использовании составляет значительные ежемесячные расходы;'),
        bullet('Конфиденциальность данных — торговые стратегии и история транзакций пользователя передаются на серверы третьих сторон;'),
        bullet('Зависимость от интернет-соединения — облачные AI-сервисы недоступны при отсутствии стабильного подключения;'),
        bullet('Ограничения регуляторов — в ряде юрисдикций передача финансовых данных в иностранные облачные системы ограничена законодательно.'),
        p('Появление системы Ollama и открытых моделей класса 7–8 миллиардов параметров (Qwen3, Llama 3, Mistral) кардинально изменило ситуацию. Современные локальные LLM способны работать на потребительском оборудовании с видеокартой NVIDIA RTX 3060 и выше, обеспечивая качество анализа, сопоставимое с облачными решениями, но без каких-либо затрат на API и без передачи данных третьим лицам.'),
        p('Таким образом, разработка платформы для AI-анализа криптовалютных рынков на основе локальных языковых моделей является актуальной и практически значимой задачей, отвечающей потребностям современного трейдерского сообщества.'),
        h2('1.2 Цели и задачи исследования'),
        p('Цель дипломной работы: разработать полнофункциональное веб-приложение для автоматического технического анализа криптовалютных рынков с использованием локальных AI-моделей, обеспечивающее генерацию торговых сигналов в режиме реального времени.'),
        p('Для достижения поставленной цели необходимо решить следующие задачи:'),
        numbered('Провести обзор предметной области: изучить методы технического анализа криптовалютного рынка, существующие аналогичные решения и технологии разработки веб-приложений;'),
        numbered('Спроектировать архитектуру системы: определить стек технологий, разработать схему базы данных, спроектировать REST API и пользовательский интерфейс;'),
        numbered('Реализовать трёхступенчатый AI-пайплайн: интегрировать локальные языковые модели Ollama для последовательного выполнения технического анализа, риск-менеджмента и финального синтеза торгового сигнала;'),
        numbered('Разработать интерактивный свечной график с возможностью наложения уровней AI-анализа, поддержкой инструментов рисования и визуальным анализом посредством мультимодальной модели;'),
        numbered('Реализовать вспомогательные модули: трейдинг-журнал, RSS-агрегатор криптоновостей, систему уведомлений, историю сигналов, настройки профиля;'),
        numbered('Провести комплексное тестирование системы, выявить и устранить дефекты;'),
        numbered('Разработать руководство пользователя.'),
        h2('1.3 Объект и предмет исследования'),
        p('Объект исследования: процессы технического анализа криптовалютных рынков с применением методов искусственного интеллекта.'),
        p('Предмет исследования: методы интеграции локальных языковых моделей в веб-приложения для генерации торговых сигналов на основе данных Binance Futures API.'),
        h2('1.4 Методы исследования'),
        p('В ходе выполнения дипломной работы использованы следующие методы:'),
        bullet('Аналитический метод — изучение существующих решений для AI-анализа криптовалютных рынков, сравнительный анализ технологий разработки;'),
        bullet('Метод прототипирования — итеративная разработка с постепенным наращиванием функционала;'),
        bullet('Структурный анализ — декомпозиция системы на независимые модули (аутентификация, AI-пайплайн, график, торговый журнал, новости);'),
        bullet('Экспериментальный метод — тестирование различных конфигураций промптов для языковых моделей с целью оптимизации качества генерируемых сигналов;'),
        bullet('Метод статического анализа кода — использование TypeScript компилятора для выявления ошибок типизации на этапе разработки.'),
        h2('1.5 Структура работы'),
        p('Дипломная работа состоит из введения, семи глав, заключения, списка использованных источников и приложений общим объёмом более 60 страниц.'),
        p('Глава 1 содержит обоснование актуальности темы, постановку целей и задач, определение объекта и предмета исследования.'),
        p('Глава 2 посвящена обзору предметной области: рассматриваются особенности криптовалютного фьючерсного рынка, методы технического анализа, а также существующие решения для AI-анализа.'),
        p('Глава 3 описывает проектирование системы: архитектуру приложения, схему базы данных, REST API и дизайн пользовательского интерфейса.'),
        p('Глава 4 содержит детальное описание реализации всех программных модулей системы.'),
        p('Глава 5 посвящена тестированию и отладке: описаны найденные дефекты и методы их устранения.'),
        p('Глава 6 представляет собой руководство пользователя.'),
        p('Глава 7 содержит выводы по результатам работы и перспективы развития системы.'),
        // ═══════════════════════════════════════════════════════════════
        // ГЛАВА 2
        // ═══════════════════════════════════════════════════════════════
        h1('ГЛАВА 2. ОБЗОР ПРЕДМЕТНОЙ ОБЛАСТИ'),
        h2('2.1 Криптовалютный рынок и фьючерсные контракты'),
        h3('2.1.1 Структура криптовалютного рынка'),
        p('Криптовалютный рынок представляет собой децентрализованную глобальную торговую площадку, функционирующую круглосуточно без перерывов и выходных дней. В отличие от традиционных финансовых рынков, торговля криптовалютами не имеет единого центрального регулятора, что обусловливает высокую волатильность и уникальные торговые возможности.'),
        p('Платформа KotvukAI ориентирована на работу с фьючерсным рынком биржи Binance (Binance Futures). Фьючерсные контракты на криптовалюту являются производными финансовыми инструментами, позволяющими трейдерам открывать как длинные (Long), так и короткие (Short) позиции с применением кредитного плеча.'),
        h3('2.1.2 Фандинг-рейт'),
        p('Фандинг-рейт (Funding Rate) — это периодические платежи между держателями длинных и коротких позиций на рынке бессрочных фьючерсов. Механизм фандинга обеспечивает привязку цены фьючерсного контракта к спотовой цене базового актива.'),
        p('Когда фандинг-рейт положительный (>0), держатели длинных позиций выплачивают фандинг держателям коротких позиций — это сигнализирует о бычьих настроениях рынка. Отрицательный фандинг-рейт (<0) свидетельствует о преобладании медвежьих настроений. Значительные отклонения фандинга (>0.1% или <-0.05%) используются в системе как дополнительный индикатор перегрева рынка.'),
        h3('2.1.3 Кредитное плечо и управление рисками'),
        p('Кредитное плечо (Leverage) позволяет трейдеру управлять позицией, превышающей его реальный капитал. Например, при плече 10x и капитале $1000 трейдер может открыть позицию на $10000. Потенциальная прибыль (и убыток) при этом умножаются на коэффициент плеча.'),
        p('Ключевые параметры управления рисками: тейк-профит (Take Profit, TP) — уровень цены, при достижении которого позиция закрывается с прибылью; стоп-лосс (Stop Loss, SL) — уровень цены, при достижении которого позиция принудительно закрывается для ограничения убытков. PnL (Profit and Loss) рассчитывается по формуле: PnL% = ((Текущая цена - Цена входа) / Цена входа) * 100 * Направление * Плечо, где Направление = +1 для Long, -1 для Short.'),
        h2('2.2 Методы технического анализа'),
        h3('2.2.1 Индекс относительной силы (RSI)'),
        p('RSI (Relative Strength Index) — осциллятор, измеряющий скорость и величину ценовых изменений. Предложен Дж. Уайлдером в 1978 году. Формула расчёта:'),
        code('RSI = 100 - 100 / (1 + RS)'),
        code('RS = Среднее значение бычьих свечей за N периодов / Среднее значение медвежьих свечей за N периодов'),
        p('В системе KotvukAI используется RSI(14) — с периодом 14 свечей. Интерпретация: RSI > 70 — зона перекупленности (потенциальный разворот вниз), RSI < 30 — зона перепроданности (потенциальный разворот вверх), RSI 30–70 — нейтральная зона.'),
        h3('2.2.2 Экспоненциальные скользящие средние (EMA)'),
        p('EMA (Exponential Moving Average) — взвешенное скользящее среднее, придающее больший вес последним значениям цены. Формула расчёта:'),
        code('EMA(t) = Цена(t) * k + EMA(t-1) * (1 - k)'),
        code('k = 2 / (N + 1)'),
        p('В системе используются EMA-50 (среднесрочный тренд) и EMA-200 (долгосрочный тренд). Положение текущей цены относительно EMA-50 и EMA-200 определяет основной тренд. "Золотой крест" — пересечение EMA-50 снизу вверх EMA-200 — является сильным бычьим сигналом. "Крест смерти" — обратное пересечение — медвежьим.'),
        h3('2.2.3 MACD'),
        p('MACD (Moving Average Convergence Divergence) — индикатор, построенный на разнице двух EMA. В системе MACD рассчитывается как разница EMA(12) и EMA(26). Положительное значение MACD свидетельствует о бычьем импульсе, отрицательное — о медвежьем.'),
        h3('2.2.4 Уровни поддержки и сопротивления'),
        p('Уровни поддержки и сопротивления определяются на основе локальных экстремумов свечного графика. В системе используется алгоритм поиска пивот-поинтов: локальный максимум считается уровнем сопротивления, если высота соответствующей свечи превышает высоты двух предшествующих и двух последующих свечей. Аналогично для уровней поддержки через локальные минимумы.'),
        p('Алгоритм выбирает 3 ближайших уровня поддержки (ниже текущей цены) и 3 ближайших уровня сопротивления (выше текущей цены), которые отображаются на графике и передаются языковой модели в качестве контекста.'),
        h3('2.2.5 Объём и фандинг как дополнительные индикаторы'),
        p('Сигнал объёма рассчитывается сравнением объёма последней свечи со средним объёмом предыдущих девяти свечей. Если текущий объём превышает среднее более чем на 20%, это классифицируется как "растущий" объём — дополнительное подтверждение тренда.'),
        h2('2.3 Обзор существующих решений'),
        p('На рынке существует ряд инструментов для анализа криптовалютных рынков. Рассмотрим основные из них и сравним с разрабатываемой системой.'),
        makeTable(
          ['Критерий', 'TradingView', '3Commas', 'Telegram-боты', 'ChatGPT API', 'KotvukAI'],
          [
            ['AI-анализ', 'Нет', 'Частично', 'Нет', 'Да', 'Да (локально)'],
            ['Стоимость', '$15-60/мес', '$25-75/мес', 'От $10/мес', '$0.01/1K tok', 'Бесплатно'],
            ['Конфиденциальность', 'Облако', 'Облако', 'Сервер бота', 'Серверы OpenAI', 'Локально'],
            ['Свечной график', 'Профессиональный', 'Базовый', 'Нет', 'Нет', 'KLineCharts v9'],
            ['Торговый журнал', 'Да', 'Да', 'Нет', 'Нет', 'Да'],
            ['Офлайн работа', 'Нет', 'Нет', 'Нет', 'Нет', 'Частично'],
            ['Open Source', 'Нет', 'Нет', 'Некоторые', 'Нет', 'Да'],
          ],
          [2600, 1300, 1300, 1300, 1300, 1300]
        ),
        caption('Таблица 2.1 — Сравнительный анализ существующих решений'),
        p('Как видно из таблицы, KotvukAI занимает уникальную нишу: единственное бесплатное решение с полноценным AI-анализом и гарантией конфиденциальности данных. TradingView превосходит по качеству графических инструментов, однако не предлагает AI-аналитику. 3Commas автоматизирует торговлю, но не обеспечивает глубокого технического анализа с обоснованием. Telegram-боты и ChatGPT API требуют постоянных финансовых затрат.'),
        h2('2.4 Обоснование выбора стека технологий'),
        p('При выборе технологического стека для разработки KotvukAI были приняты во внимание следующие критерии: производительность, экосистема, типобезопасность, простота развёртывания и соответствие задачам проекта.'),
        makeTable(
          ['Компонент', 'Выбранная технология', 'Альтернативы', 'Обоснование выбора'],
          [
            ['Frontend фреймворк', 'Next.js 14', 'Nuxt.js, SvelteKit', 'App Router, SSR, API Routes в одном проекте'],
            ['UI библиотека', 'React 18', 'Vue 3, Svelte', 'Богатая экосистема, forwardRef, hooks'],
            ['Язык', 'TypeScript 5', 'JavaScript', 'Строгая типизация, ловля ошибок на этапе компиляции'],
            ['Аутентификация', 'Firebase Auth', 'Auth0, NextAuth', 'Google OAuth из коробки, бесплатный tier'],
            ['База данных', 'Neon PostgreSQL', 'PlanetScale, Supabase', 'Serverless, нет cold start, щедрый free tier'],
            ['AI движок', 'Ollama', 'llama.cpp, LM Studio', 'REST API, простая установка, широкий выбор моделей'],
            ['График', 'KLineCharts v9', 'Lightweight Charts, D3', 'Специализирован для финансов, npm пакет'],
            ['Стили', 'Чистый CSS', 'Tailwind, Styled Components', 'Полный контроль, нет зависимостей'],
          ],
          [2200, 1800, 2200, 3000]
        ),
        caption('Таблица 2.2 — Обоснование выбора технологий'),
        // ═══════════════════════════════════════════════════════════════
        // ГЛАВА 3
        // ═══════════════════════════════════════════════════════════════
        h1('ГЛАВА 3. ПРОЕКТИРОВАНИЕ СИСТЕМЫ'),
        h2('3.1 Архитектура приложения'),
        p('Система KotvukAI построена по принципу трёхслойной архитектуры, реализованной в рамках единого Next.js 14 приложения с App Router. Такой подход устраняет необходимость в отдельном backend-сервере, упрощает развёртывание и обеспечивает высокую связность компонентов.'),
        h3('3.1.1 Слои архитектуры'),
        p('Слой представления (Presentation Layer) реализован в виде React-клиентских компонентов, работающих в браузере. Включает 7 панелей Dashboard (Dash, AI, Trades, News, Alerts, History, Settings), компонент Header с live-тикерами, свечной график KLineChartComponent, систему Toast-уведомлений и контексты аутентификации и локализации.'),
        p('Слой бизнес-логики (Business Logic Layer) реализован через Next.js API Routes (серверные обработчики запросов). Включает 16 REST API эндпоинтов, три модуля AI-анализа (technicalAnalysis, riskAssessment, finalSynthesis), алгоритмы расчёта технических индикаторов (RSI, EMA, MACD), а также модуль аутентификации с Firebase Admin SDK.'),
        p('Слой данных (Data Layer) включает облачную базу данных Neon PostgreSQL, доступ к которой осуществляется через библиотеку @neondatabase/serverless без необходимости поддержания постоянного соединения. Firebase Authentication хранит пользовательские учётные данные и обеспечивает верификацию токенов.'),
        h3('3.1.2 Схема взаимодействия компонентов'),
        p('Браузер (React) взаимодействует с Next.js API Routes посредством HTTP-запросов с аутентификационным cookie (fb_token). Middleware проверяет наличие токена до передачи запроса обработчику. API Routes обращаются к Firebase Admin SDK для верификации токена, к Neon PostgreSQL для операций с данными и к Ollama API для выполнения AI-анализа. Binance Futures API используется для получения рыночных данных (свечи, текущие цены, фандинг-рейт). RSS-парсер агрегирует новостные ленты CoinTelegraph и CoinDesk.'),
        h2('3.2 Проектирование базы данных'),
        p('База данных системы KotvukAI состоит из четырёх взаимосвязанных таблиц. Все таблицы используют автоинкрементные первичные ключи SERIAL и временные метки TIMESTAMPTZ для записи времени создания в UTC.'),
        h3('3.2.1 Таблица users'),
        p('Центральная таблица пользователей хранит данные аккаунта и пользовательские настройки:'),
        code('CREATE TABLE users ('),
        code('  id           SERIAL PRIMARY KEY,'),
        code('  firebase_uid TEXT UNIQUE NOT NULL,  -- уникальный идентификатор Firebase Auth'),
        code('  email        TEXT,                  -- email пользователя'),
        code('  nickname     TEXT,                  -- отображаемое имя'),
        code('  lang         TEXT DEFAULT \'ru\',     -- предпочитаемый язык интерфейса'),
        code('  created_at   TIMESTAMPTZ DEFAULT NOW()'),
        code(')'),
        p('Поле firebase_uid имеет ограничение UNIQUE, что гарантирует однозначное соответствие между Firebase-пользователем и записью в PostgreSQL. При повторном входе выполняется операция UPSERT (INSERT ... ON CONFLICT DO UPDATE), обновляющая email без создания дублирующих записей.'),
        h3('3.2.2 Таблица signals'),
        p('Таблица хранит результаты AI-анализа, сгенерированные для конкретного пользователя:'),
        code('CREATE TABLE signals ('),
        code('  id                SERIAL PRIMARY KEY,'),
        code('  user_id           INTEGER REFERENCES users(id),'),
        code('  pair              TEXT NOT NULL,         -- торговая пара (BTC/USDT)'),
        code('  timeframe         TEXT NOT NULL,         -- таймфрейм (1ч, 4ч, 1д)'),
        code('  final_verdict     TEXT,                  -- LONG | SHORT | WAIT'),
        code('  final_confidence  INTEGER,               -- уверенность 0-100%'),
        code('  final_entry       NUMERIC,               -- цена входа'),
        code('  final_tp          NUMERIC,               -- тейк-профит'),
        code('  final_sl          NUMERIC,               -- стоп-лосс'),
        code('  final_leverage    INTEGER,               -- рекомендованное плечо'),
        code('  final_risk_score  INTEGER,               -- оценка риска 1-10'),
        code('  outcome           TEXT,                  -- win | loss (заполняется вручную)'),
        code('  actual_pnl_pct    NUMERIC,               -- фактический PnL%'),
        code('  raw_response      JSONB,                 -- полный JSON-ответ AI'),
        code('  created_at        TIMESTAMPTZ DEFAULT NOW()'),
        code(')'),
        h3('3.2.3 Таблица trades'),
        p('Таблица трейдинг-журнала хранит бумажные сделки пользователя:'),
        code('CREATE TABLE trades ('),
        code('  id          SERIAL PRIMARY KEY,'),
        code('  user_id     INTEGER REFERENCES users(id),'),
        code('  pair        TEXT NOT NULL,'),
        code('  direction   TEXT NOT NULL,    -- long | short'),
        code('  order_type  TEXT NOT NULL,    -- market | limit'),
        code('  amount      NUMERIC NOT NULL, -- сумма позиции в USDT'),
        code('  entry_price NUMERIC,          -- цена входа'),
        code('  tp_price    NUMERIC,          -- тейк-профит'),
        code('  sl_price    NUMERIC,          -- стоп-лосс'),
        code('  leverage    INTEGER DEFAULT 1,'),
        code('  status      TEXT DEFAULT \'open\', -- open | closed'),
        code('  pnl         NUMERIC,          -- фактический PnL в USDT'),
        code('  pnl_pct     NUMERIC,          -- PnL в процентах'),
        code('  closed_at   TIMESTAMPTZ,'),
        code('  created_at  TIMESTAMPTZ DEFAULT NOW()'),
        code(')'),
        h3('3.2.4 Таблица notifications'),
        code('CREATE TABLE notifications ('),
        code('  id         SERIAL PRIMARY KEY,'),
        code('  user_id    INTEGER REFERENCES users(id),'),
        code('  message    TEXT NOT NULL,'),
        code('  read       BOOLEAN DEFAULT FALSE,'),
        code('  created_at TIMESTAMPTZ DEFAULT NOW()'),
        code(')'),
        h2('3.3 Проектирование REST API'),
        p('API системы реализован через Next.js App Router API Routes и включает 16 эндпоинтов. Все маршруты, кроме /api/auth/sync, защищены аутентификационным middleware.'),
        makeTable(
          ['Метод', 'Маршрут', 'Описание', 'Аутентификация'],
          [
            ['POST', '/api/auth/sync', 'Верификация Firebase токена, upsert пользователя в БД', 'Нет'],
            ['POST', '/api/analyze', '3-шаговый AI-анализ: Binance данные + Ollama + сохранение', 'Да'],
            ['POST', '/api/analyze-chart', 'Vision AI: анализ скриншота графика мультимодальной LLM', 'Да'],
            ['GET', '/api/klines', 'Прокси к Binance Futures klines API (CORS bypass)', 'Да'],
            ['GET', '/api/news', 'Агрегация RSS CoinTelegraph + CoinDesk с сентиментом', 'Да'],
            ['GET', '/api/notifications', 'Последние 50 уведомлений пользователя', 'Да'],
            ['DELETE', '/api/notifications', 'Удаление всех уведомлений пользователя', 'Да'],
            ['PATCH', '/api/notifications/read', 'Отметить все уведомления как прочитанные', 'Да'],
            ['GET', '/api/settings', 'Получение профиля (nickname, email, lang)', 'Да'],
            ['POST', '/api/settings', 'Обновление настроек профиля', 'Да'],
            ['GET', '/api/signals', 'История сигналов пользователя (лимит 100)', 'Да'],
            ['PATCH', '/api/signals/[id]/outcome', 'Отметить сигнал как win/loss', 'Да'],
            ['GET', '/api/stats', 'Агрегированная статистика (win rate, avg confidence)', 'Да'],
            ['GET', '/api/trades', 'Список всех сделок пользователя', 'Да'],
            ['POST', '/api/trades', 'Создание новой сделки', 'Да'],
            ['PATCH', '/api/trades/[id]/close', 'Закрытие сделки с расчётом PnL', 'Да'],
          ],
          [800, 2000, 3600, 1200]
        ),
        caption('Таблица 3.1 — REST API эндпоинты системы KotvukAI'),
        h2('3.4 Проектирование AI-пайплайна'),
        p('AI-пайплайн системы KotvukAI реализован по принципу последовательной цепочки запросов к языковой модели, где результат каждого шага передаётся в контекст следующего. Это обеспечивает накопление аналитического контекста и более обоснованный итоговый сигнал.'),
        h3('3.4.1 Шаг 1: Технический анализ'),
        p('На первом шаге модель получает следующие данные: текущую цену актива, значения RSI(14), MACD, EMA-50, EMA-200, сигнал объёма, фандинг-рейт, последние 10 OHLCV-свечей, а также уровни поддержки и сопротивления. Задача модели — оценить техническую картину и вернуть структурированный JSON:'),
        code('{ "signal": "LONG" | "SHORT" | "WAIT",'),
        code('  "strength": <1-10>,'),
        code('  "trend": "восходящий" | "нисходящий" | "боковой",'),
        code('  "summary": "<краткий анализ>" }'),
        h3('3.4.2 Шаг 2: Риск-менеджмент'),
        p('На втором шаге модель получает результат первого шага и расширенный рыночный контекст. Задача — оценить риски и вернуть:'),
        code('{ "verdict": "LONG" | "SHORT" | "WAIT",'),
        code('  "confidence": <0-100>,'),
        code('  "risk_score": <1-10>,'),
        code('  "leverage": <1-20>,'),
        code('  "summary": "<объяснение риска>" }'),
        h3('3.4.3 Шаг 3: Финальный синтез'),
        p('На третьем шаге модель получает результаты обоих предыдущих шагов и синтезирует полный торговый сигнал:'),
        code('{ "verdict": "LONG"|"SHORT"|"WAIT",'),
        code('  "confidence": 0-100,'),
        code('  "entry_price": <число>,'),
        code('  "entry_type": "market"|"limit",'),
        code('  "tp_price": <число>, "tp_pct": <число>,'),
        code('  "sl_price": <число>, "sl_pct": <число>,'),
        code('  "full_description": "...",'),
        code('  "entry_instruction": "...",'),
        code('  "exit_instruction": "...",'),
        code('  "why_this_signal": "...",'),
        code('  "insights": [{icon, tag, text}, ...] }'),
        p('Параметры модели для всех трёх шагов: temperature = 0.3 (баланс между детерминированностью и творческим мышлением), num_predict = 2048 (максимальное количество генерируемых токенов), timeout = 120 секунд (достаточно для работы на CPU без GPU).'),
        h2('3.5 Проектирование пользовательского интерфейса'),
        p('UI системы KotvukAI построен по принципу единостраничного приложения (SPA) с навигационной панелью и динамическим отображением панелей. Реализована тёмная цветовая схема, ориентированная на длительное использование в условиях торгового монитора.'),
        p('Цветовая схема: фон #080808 (почти чёрный), акцентный цвет #00d4ff (cyan), LONG/бычий #00e676 (зелёный), SHORT/медвежий #ff3d57 (красный), WAIT/нейтральный #ffb300 (янтарный). Основной шрифт — Geist Mono (моноширинный), заголовки — Syne (display).'),
        p('Макет приложения использует CSS Grid с тремя строками: Header (42px) — Navigation (36px) — Content (1fr). Семь навигационных панелей переключаются без перезагрузки страницы. Свечной график занимает 340px по высоте, AI-результаты и торговые элементы располагаются ниже.'),
        // ═══════════════════════════════════════════════════════════════
        // ГЛАВА 4
        // ═══════════════════════════════════════════════════════════════
        h1('ГЛАВА 4. РЕАЛИЗАЦИЯ СИСТЕМЫ'),
        h2('4.1 Стек технологий и структура проекта'),
        p('Проект реализован в виде монорепозитория Next.js 14 с App Router. Структура директорий следует соглашениям Next.js:'),
        bullet('app/ — страницы и API-маршруты (login, register, dashboard, api/*)'),
        bullet('components/ — переиспользуемые React-компоненты (app/panels/*, app/chart/*, ui/*)'),
        bullet('contexts/ — контексты React (AuthContext, LangContext)'),
        bullet('lib/ — серверные утилиты (db.ts, ollama.ts, firebase-admin.ts, auth-helper.ts)'),
        bullet('messages/ — файлы переводов (ru.json, en.json, kz.json)'),
        h2('4.2 Аутентификация и безопасность'),
        p('Система аутентификации построена на двухуровневой проверке: клиентская аутентификация Firebase и серверная верификация через Firebase Admin SDK.'),
        p('При входе пользователя Firebase Auth генерирует JWT-токен (ID Token) со сроком действия 1 час. Токен сохраняется в cookie fb_token с параметрами path=/, max-age=3600, SameSite=Strict. Параметр SameSite=Strict защищает от CSRF-атак.'),
        p('Next.js Middleware перехватывает все запросы к защищённым маршрутам (/dashboard/*, /api/* кроме /api/auth/sync) и проверяет наличие fb_token в cookies. Если токен отсутствует, браузерные запросы перенаправляются на /login (HTTP 307), API-запросы получают ответ {"ok": false, "error": "Unauthorized"} со статусом 401.'),
        p('На уровне API Routes каждый обработчик дополнительно верифицирует токен через Firebase Admin SDK (функция verifyToken), после чего извлекает uid пользователя и загружает его запись из PostgreSQL. Это обеспечивает защиту от подделки cookie на клиенте.'),
        h2('4.3 Реализация AI-пайплайна'),
        p('Центральный модуль системы — файл lib/ollama.ts — реализует трёхступенчатый AI-пайплайн. Каждый шаг является асинхронным HTTP-запросом к Ollama REST API.'),
        h3('4.3.1 Вычисление рыночных данных'),
        p('Функция calcMarketData принимает массив свечей (Candle[]) и значение фандинг-рейта, вычисляет все технические индикаторы и формирует объект MarketData для передачи в промпты. RSI рассчитывается методом Уайлдера с экспоненциальным сглаживанием. EMA вычисляется с коэффициентом k = 2/(N+1). MACD = EMA(12) - EMA(26). Уровни S/R определяются через поиск пивот-поинтов среди последних 50 свечей.'),
        h3('4.3.2 Обработка thinking-блоков qwen3'),
        p('Модель qwen3:8b поддерживает режим "глубокого размышления" (thinking mode), при котором перед JSON-ответом генерирует блок <think>...</think> с промежуточными рассуждениями. Без обработки этих блоков парсинг JSON завершился бы с ошибкой, так как регулярное выражение захватывало бы { из блока размышлений.'),
        p('Функция extractJSON() реализует двухэтапную обработку: сначала удаляет все thinking-блоки регулярным выражением /<think>[\\s\\S]*?<\\/think>/gi, затем извлекает JSON через поиск markdown-блока ```json...``` или первой встреченной пары {…}.'),
        h2('4.4 Реализация свечного графика'),
        p('Компонент KLineChartComponent реализован с использованием паттернов React forwardRef и useImperativeHandle, что позволяет родительскому компоненту AiPanel управлять графиком через ref-хэндл: загружать данные, делать скриншот, рисовать уровни и управлять инструментами рисования.'),
        p('Важным архитектурным решением стал отказ от загрузки библиотеки KLineCharts через CDN в пользу прямого npm-импорта. Исходный код загружал скрипт через тег <script>, что приводило к нестабильной инициализации при плохом соединении. Прямой импорт гарантирует доступность библиотеки, обеспечивает строгую типизацию TypeScript через встроенные .d.ts декларации и ускоряет инициализацию.'),
        p('После получения AI-анализа функция drawMarkupInternal наносит на график: линию Entry (cyan #00d4ff), линию Take Profit (green #00e676) с подписью TP +X%, линию Stop Loss (red #ff3d57) с подписью SL -X%, уровни поддержки (полупрозрачный зелёный) и сопротивления (полупрозрачный красный). Все линии используются тип overlay "priceLine" библиотеки KLineCharts.'),
        h2('4.5 Реализация Vision AI'),
        p('Функция Vision AI позволяет пользователю получить текстовый анализ текущего состояния графика от мультимодальной языковой модели qwen3-vl:8b. Процесс состоит из трёх этапов: снятие скриншота графика, кодирование в base64 и отправка на Ollama API с промптом на русском языке.'),
        p('Скриншот создаётся методом getConvertPictureUrl(true, "png", "#080808") библиотеки KLineCharts, который рендерит текущее состояние canvas в base64-кодированный PNG. Изображение передаётся в параметре images[] запроса к Ollama. Модель qwen3-vl:8b анализирует видимые на графике паттерны, уровни и тренды.'),
        h2('4.6 Трейдинг-журнал'),
        p('Модуль трейдинг-журнала (TradesPanel) реализует функциональность бумажной торговли — симуляцию без реального подключения к бирже. Пользователь может открыть позицию с параметрами: торговая пара, тип ордера (маркет/лимит), направление (long/short), сумма в USDT, уровни TP/SL и кредитное плечо от 1x до 100x.'),
        p('Перед открытием позиции компонент рассчитывает превью PnL в реальном времени: при указанных TP и SL вычисляется ожидаемая прибыль и максимальный убыток с учётом плеча. При закрытии позиции API-маршрут автоматически запрашивает текущую цену актива через Binance Futures ticker API и рассчитывает фактический PnL.'),
        h2('4.7 RSS-агрегатор новостей'),
        p('Модуль новостей (NewsPanel) агрегирует RSS-ленты двух ведущих крипто-медиа: CoinTelegraph и CoinDesk. Для парсинга используется библиотека rss-parser. Каждая статья обрабатывается функцией getSentiment(), которая классифицирует заголовок по двум спискам ключевых слов: бычьих (bull, rally, surge, breakout, ATH, moon и др.) и медвежьих (bear, crash, dump, plunge, panic и др.). Результирующий тег BULLISH/BEARISH/NEUTRAL отображается рядом с заголовком статьи.'),
        h2('4.8 Система уведомлений'),
        p('Уведомления создаются автоматически при двух событиях: завершении AI-анализа (сообщение содержит вердикт, пару, таймфрейм и уровень уверенности) и открытии/закрытии торговой позиции. Панель уведомлений (NotifsPanel) при загрузке автоматически отмечает все уведомления как прочитанные. Количество непрочитанных уведомлений отображается красной точкой на иконке навигационного пункта "Alerts".'),
        h2('4.9 Интернационализация'),
        p('Система поддерживает три языка интерфейса: русский (ru), английский (en) и казахский (kz). Все текстовые строки вынесены в JSON-файлы в директории messages/. Каждый файл содержит 115 ключей перевода, охватывающих все элементы UI от навигации до сообщений об ошибках.'),
        p('Контекст LangContext реализует функцию t(key) — type-safe хелпер, принимающий только существующие ключи (keyof Translations). Выбранный язык сохраняется в localStorage под ключом kotvuk_lang и восстанавливается при следующем посещении сайта.'),
        // ═══════════════════════════════════════════════════════════════
        // ГЛАВА 5
        // ═══════════════════════════════════════════════════════════════
        h1('ГЛАВА 5. ТЕСТИРОВАНИЕ И ОТЛАДКА'),
        h2('5.1 Виды тестирования'),
        p('В ходе разработки системы KotvukAI применялись следующие виды тестирования: статический анализ кода (TypeScript компилятор), функциональное тестирование API-эндпоинтов, интеграционное тестирование взаимодействия компонентов, тестирование пользовательских сценариев в браузере.'),
        h2('5.2 Статический анализ TypeScript'),
        p('TypeScript компилятор выполняет статическую проверку типов во время разработки, обнаруживая ошибки до запуска кода. В ходе разработки были выявлены и исправлены следующие TypeScript-ошибки:'),
        h3('5.2.1 TS18048: klinecharts possibly undefined'),
        p('При использовании CDN-загрузки библиотеки KLineCharts код объявлял глобальную переменную через declare const klinecharts: any. TypeScript в strict-режиме генерировал предупреждение TS18048, так как переменная могла быть недоступна до загрузки CDN-скрипта. Попытка добавить проверку typeof klinecharts !== "undefined" привела к новой ошибке TS2339 (Property "dispose" does not exist on type "never") из-за особенностей сужения типов TypeScript для any. Решение: полный отказ от CDN в пользу прямого import * as klinecharts from "klinecharts". Это устранило все TypeScript-ошибки и сделало доступными полноценные типы библиотеки.'),
        h3('5.2.2 Неверный тип LineType'),
        p('После перехода на прямой импорт TypeScript начал проверять типы параметров инициализации графика. Строковые литералы "dashed" для параметров стиля сетки и перекрестия оказались несовместимы с enum LineType из klinecharts. Решение: замена строк на LineType.Dashed из официального API библиотеки.'),
        h2('5.3 Тестирование API-эндпоинтов'),
        makeTable(
          ['Эндпоинт', 'Метод', 'Статус', 'Результат тестирования'],
          [
            ['/api/auth/sync', 'POST', '200 OK', 'Пользователь создан/обновлён в PostgreSQL'],
            ['/api/klines', 'GET', '200 OK', 'Возвращает массив свечей Binance Futures'],
            ['/api/analyze', 'POST', '200 OK', 'AI-пайплайн выполнен, сигнал сохранён в БД'],
            ['/api/analyze-chart', 'POST', '200 OK', 'Vision AI возвращает текстовый анализ графика'],
            ['/api/news', 'GET', '200 OK', 'RSS-ленты агрегированы, сентимент определён'],
            ['/api/signals', 'GET', '200 OK', 'История сигналов возвращается из PostgreSQL'],
            ['/api/stats', 'GET', '200 OK', 'Агрегированная статистика рассчитана корректно'],
            ['/api/trades', 'GET/POST', '200 OK', 'Сделки создаются и возвращаются'],
            ['/api/trades/[id]/close', 'PATCH', '200 OK', 'Сделка закрыта, PnL рассчитан по Binance цене'],
            ['/api/notifications', 'GET/DELETE', '200 OK', 'Уведомления возвращаются и удаляются'],
            ['/api/settings', 'GET/POST', '200 OK', 'Профиль читается и обновляется'],
            ['/api/signals/[id]/outcome', 'PATCH', '200 OK', 'Исход сигнала win/loss сохранён'],
          ],
          [2200, 800, 1000, 4300]
        ),
        caption('Таблица 5.1 — Результаты тестирования API-эндпоинтов'),
        h2('5.4 Тестирование пользовательских сценариев'),
        h3('Сценарий 1: Регистрация и вход'),
        p('Пользователь открывает /register, вводит никнейм, email и пароль (min 6 символов), нажимает "Создать". Firebase Auth создаёт аккаунт, AuthContext получает токен, синхронизирует с PostgreSQL через /api/auth/sync. Middleware обнаруживает fb_token cookie и разрешает доступ к /dashboard. Результат: успешный вход, пользователь видит Dashboard. Тест: пройден.'),
        h3('Сценарий 2: AI-анализ с отображением на графике'),
        p('Пользователь переключается на панель "AI Analysis", выбирает BTC/USDT и таймфрейм 1H. График автоматически загружает 300 свечей через /api/klines. Пользователь нажимает кнопку "АНАЛИЗ". Система показывает индикатор загрузки с чередованием шагов: получение данных — технический анализ — оценка рисков — финальный вердикт. По завершении отображается вердикт (LONG/SHORT/WAIT), уверенность, плечо, уровни входа/TP/SL, результаты трёх шагов пайплайна, инсайты и объяснение. На графике отображаются линии Entry, TP, SL и уровни S/R. Результат: успешно. Тест: пройден.'),
        h3('Сценарий 3: Открытие и закрытие позиции'),
        p('Пользователь переходит в "Trades", выбирает ETH/USDT, тип Market, направление Long, вводит сумму 100 USDT и плечо 5x, устанавливает TP и SL. Компонент показывает превью ожидаемой прибыли/убытка. Нажатие "ОТКРЫТЬ ЛОНГ" создаёт запись в PostgreSQL. Позиция появляется в таблице открытых позиций. При нажатии "ЗАКРЫТЬ" система запрашивает текущую цену ETH через Binance Futures ticker и рассчитывает реальный PnL. Позиция перемещается в таблицу закрытых сделок. Результат: успешно. Тест: пройден.'),
        h3('Сценарий 4: Новости и уведомления'),
        p('Панель "News" загружает RSS-ленты CoinTelegraph и CoinDesk, отображает заголовки с тегами BULLISH/BEARISH/NEUTRAL. Кнопка "ОБНОВИТЬ" выполняет повторный запрос. Панель "Alerts" показывает уведомления об анализах и сделках. Кнопка "Очистить" удаляет все уведомления. Результат: успешно. Тест: пройден.'),
        h3('Сценарий 5: Настройки профиля'),
        p('Пользователь переходит в "Settings", изменяет никнейм и сохраняет. Запрос POST /api/settings обновляет запись в PostgreSQL. Смена пароля: пользователь вводит новый пароль и подтверждение, нажимает "СОХРАНИТЬ" — система вызывает updatePassword() Firebase Auth. Переключение языка: нажатие EN/RU/KZ мгновенно изменяет язык всего интерфейса. Результат: успешно. Тест: пройден.'),
        h2('5.5 Найденные и устранённые дефекты'),
        makeTable(
          ['№', 'Дефект', 'Причина', 'Решение', 'Файл'],
          [
            ['1', 'TypeError: sql is not a function на всех API', 'Proxy target {} не является функцией — apply trap не работает с тегированными шаблонами', 'Замена {} на function(){} в качестве Proxy target', 'lib/db.ts'],
            ['2', 'График не отображается', 'klinecharts загружался через CDN <script>; при сбое или медленной сети chart не инициализировался', 'Прямой import из npm пакета (уже был установлен)', 'KLineChartComponent.tsx'],
            ['3', 'Ошибка Analyze: No JSON found', 'qwen3:8b выводит <think>...</think> блоки перед JSON — регулярное выражение захватывало { из thinking-блоков', 'Очистка <think>...</think> перед поиском JSON', 'lib/ollama.ts'],
            ['4', 'PnL при закрытии сделки = null', 'Клиент передавал пустой {} в тело запроса; сервер не рассчитывал PnL самостоятельно', 'Сервер запрашивает Binance ticker и рассчитывает PnL автоматически', 'trades/[id]/close'],
            ['5', 'Смена пароля не работала', 'Форма валидировала поля, но не вызывала Firebase updatePassword()', 'Добавлен вызов updatePassword(user, pass) после сохранения настроек', 'SettingsPanel.tsx'],
          ],
          [400, 2200, 2600, 2400, 1600]
        ),
        caption('Таблица 5.2 — Найденные и устранённые дефекты системы'),
        h2('5.6 Производительность системы'),
        makeTable(
          ['Метрика', 'Значение', 'Примечание'],
          [
            ['Time-to-Interactive', '~2.7 сек', 'Next.js dev server, первый запуск'],
            ['Загрузка графика', '300-600 мс', 'Binance API latency + KLineCharts render'],
            ['AI-анализ (3 шага)', '30-90 сек', 'Зависит от GPU/CPU и модели qwen3:8b'],
            ['Vision AI', '15-40 сек', 'qwen3-vl:8b на GPU RTX 3060'],
            ['API /api/klines', '200-400 мс', 'Binance Futures публичный API'],
            ['API /api/news', '1.5-3 сек', 'Два RSS-запроса параллельно'],
            ['Использование RAM (Ollama)', '~5 GB', 'Модели qwen3:8b Q4_K_M загружены'],
          ],
          [3200, 2000, 4000]
        ),
        caption('Таблица 5.3 — Показатели производительности системы'),
        // ═══════════════════════════════════════════════════════════════
        // ГЛАВА 6
        // ═══════════════════════════════════════════════════════════════
        h1('ГЛАВА 6. РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ'),
        h2('6.1 Системные требования'),
        makeTable(
          ['Компонент', 'Минимум', 'Рекомендуется'],
          [
            ['ОС', 'Windows 10, macOS 12, Ubuntu 20.04', 'Windows 11, macOS 14, Ubuntu 22.04'],
            ['Процессор', 'Intel i5 8-го поколения / Ryzen 5 3600', 'Intel i7 12-го поколения / Ryzen 7 5800X'],
            ['Оперативная память', '8 GB RAM', '16 GB RAM (32 GB для комфортной работы)'],
            ['Видеокарта', 'Не обязательна (CPU-режим Ollama)', 'NVIDIA RTX 3060+ с 8+ GB VRAM'],
            ['Хранилище', '10 GB свободного места', '20 GB (модели Ollama ~11 GB)'],
            ['Интернет', 'Требуется для Binance API и RSS', 'Стабильное широкополосное'],
            ['Node.js', 'v18.x LTS', 'v20.x LTS или v22.x'],
          ],
          [2500, 2900, 3900]
        ),
        caption('Таблица 6.1 — Системные требования'),
        h2('6.2 Установка и запуск'),
        h3('Шаг 1: Установка Ollama и моделей'),
        p('Скачайте и установите Ollama с официального сайта https://ollama.com для вашей операционной системы. После установки выполните в терминале:'),
        code('ollama pull qwen3:8b          # ~5.2 GB, текстовая модель'),
        code('ollama pull qwen3-vl:8b       # ~6.1 GB, мультимодальная модель'),
        p('Убедитесь, что Ollama запущена: в браузере откройте http://localhost:11434 — должен отображаться текст "Ollama is running".'),
        h3('Шаг 2: Установка зависимостей'),
        code('cd "D:\\Проект 2.0"'),
        code('npm install'),
        h3('Шаг 3: Настройка переменных окружения'),
        p('Скопируйте файл .env.local.example в .env.local и заполните следующие переменные:'),
        code('# Firebase (получить на console.firebase.google.com)'),
        code('NEXT_PUBLIC_FIREBASE_API_KEY=...'),
        code('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...'),
        code('NEXT_PUBLIC_FIREBASE_PROJECT_ID=...'),
        code(''),
        code('# Firebase Admin (сервисный аккаунт)'),
        code('FIREBASE_ADMIN_PROJECT_ID=...'),
        code('FIREBASE_ADMIN_CLIENT_EMAIL=...'),
        code('FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..."'),
        code(''),
        code('# Neon PostgreSQL'),
        code('DATABASE_URL=postgresql://...@...neon.tech/neondb'),
        code(''),
        code('# Ollama (по умолчанию localhost)'),
        code('OLLAMA_BASE_URL=http://localhost:11434'),
        code('OLLAMA_TEXT_MODEL=qwen3:8b'),
        code('OLLAMA_VISION_MODEL=qwen3-vl:8b'),
        h3('Шаг 4: Запуск приложения'),
        code('npm run dev'),
        p('Откройте браузер и перейдите по адресу http://localhost:3000. Приложение автоматически перенаправит на страницу входа.'),
        h2('6.3 Регистрация и вход в систему'),
        p('На странице /login введите email и пароль для входа в существующий аккаунт, или нажмите "Войти через Google" для аутентификации через Google OAuth. Для создания нового аккаунта нажмите ссылку "Создать" и заполните форму регистрации: никнейм (опционально), email, пароль (минимум 6 символов) и подтверждение пароля.'),
        h2('6.4 Панель AI-анализа'),
        p('После входа нажмите на пункт "AI Analysis" в навигации. На панели AI-анализа:'),
        numbered('Выберите торговую пару из выпадающего списка (доступно 30 пар: BTC, ETH, BNB, SOL, XRP и другие);'),
        numbered('Выберите таймфрейм: 1M, 5M, 15M, 30M, 1H, 4H или 1D;'),
        numbered('Дождитесь загрузки свечного графика (правый сайдбар покажет данные последней свечи);'),
        numbered('Нажмите кнопку "АНАЛИЗ" и дождитесь результата (30–90 секунд);'),
        numbered('Изучите результат: вердикт (LONG/SHORT/WAIT), уверенность %, риск /10, рекомендованное плечо, цены входа/TP/SL;'),
        numbered('Опционально нажмите "AI ЗРЕНИЕ" для визуального анализа текущего состояния графика.'),
        p('Инструменты рисования: нажмите кнопку "╱" для трендовой линии, "—" для горизонтальной линии, "$" для ценового уровня, "φ" для инструмента Фибоначчи, "✕" для очистки всех рисунков.'),
        h2('6.5 Трейдинг-журнал'),
        p('Для открытия новой позиции заполните форму: выберите пару, тип ордера (Маркет/Лимит), направление (ЛОНГ/ШОРТ), введите сумму в USDT. При выборе лимитного ордера укажите цену входа. Опционально установите уровни TP и SL — компонент автоматически рассчитает ожидаемую прибыль и убыток. Установите кредитное плечо ползунком (1x–100x). Нажмите "ОТКРЫТЬ ЛОНГ" или "ОТКРЫТЬ ШОРТ".'),
        p('В таблице открытых позиций нажмите "ЗАКРЫТЬ" для закрытия позиции по текущей рыночной цене. PnL рассчитывается автоматически на основе текущей цены Binance Futures.'),
        h2('6.6 Новости, история и настройки'),
        p('Панель "News" отображает последние 30 новостей из CoinTelegraph и CoinDesk с тегами BULLISH/BEARISH/NEUTRAL. Нажмите на новость для открытия оригинальной статьи в новой вкладке.'),
        p('Панель "History" содержит полную историю AI-сигналов. Для каждого сигнала можно отметить фактический результат: нажмите кнопку "W" (Win) или "L" (Loss) — это помогает отслеживать точность сигналов.'),
        p('Панель "Settings" позволяет изменить никнейм, email, пароль и язык интерфейса (RU/EN/KZ).'),
        // ═══════════════════════════════════════════════════════════════
        // ГЛАВА 7
        // ═══════════════════════════════════════════════════════════════
        h1('ГЛАВА 7. ЗАКЛЮЧЕНИЕ'),
        h2('7.1 Выводы по результатам работы'),
        p('В ходе выполнения дипломной работы было успешно разработано полнофункциональное веб-приложение KotvukAI для интеллектуального анализа криптовалютных рынков на основе локальных ИИ-моделей. Сформулируем основные итоги:'),
        bullet('Реализован трёхступенчатый AI-пайплайн, обеспечивающий последовательное выполнение технического анализа, риск-менеджмента и финального синтеза торгового сигнала с использованием локальной языковой модели qwen3:8b через Ollama;'),
        bullet('Разработана система расчёта технических индикаторов (RSI, EMA-50/200, MACD, объём, уровни S/R) непосредственно на стороне сервера без зависимости от сторонних аналитических сервисов;'),
        bullet('Реализован интерактивный свечной график на базе KLineCharts v9 с инструментами рисования, наложением уровней AI-анализа и поддержкой скриншота для Vision AI анализа;'),
        bullet('Созданы вспомогательные модули: трейдинг-журнал с автоматическим расчётом PnL, RSS-агрегатор новостей с сентимент-анализом, система уведомлений, история сигналов;'),
        bullet('Обеспечена трёхъязычная поддержка интерфейса (русский, английский, казахский);'),
        bullet('В ходе тестирования выявлено и устранено 5 критических дефектов, включая фундаментальную ошибку инициализации Proxy-объекта базы данных.'),
        p('Ключевым достижением проекта является демонстрация возможности создания профессионального аналитического инструмента с AI на полностью локальной инфраструктуре без каких-либо затрат на API. Это открывает перспективы для разработчиков, стремящихся создавать AI-приложения с гарантией конфиденциальности данных.'),
        h2('7.2 Перспективы развития'),
        p('Разработанная система имеет значительный потенциал для дальнейшего развития по нескольким направлениям:'),
        h3('Техническое улучшение'),
        bullet('WebSocket-соединение с Binance Futures для обновления графика в реальном времени вместо периодических polling-запросов;'),
        bullet('Подключение реальной торговли через Binance Futures API с использованием API-ключей пользователя;'),
        bullet('Реализация автоматического бэктестинга сигналов на исторических данных для оценки точности модели;'),
        bullet('Кэширование свечных данных в Redis для снижения нагрузки на Binance API.'),
        h3('Расширение функционала'),
        bullet('Поддержка дополнительных бирж: OKX, Bybit, KuCoin;'),
        bullet('Телеграм-бот для получения торговых сигналов и уведомлений без необходимости открывать браузер;'),
        bullet('Mobile-friendly адаптация интерфейса и Progressive Web App (PWA) для установки на смартфон;'),
        bullet('Расширенная аналитика: графики PnL по времени, тепловые карты по парам, экспорт истории в CSV.'),
        h3('AI-улучшения'),
        bullet('Тонкая настройка (fine-tuning) модели на историческом наборе данных реальных торговых сигналов;'),
        bullet('Интеграция дополнительных источников данных: данные on-chain, настроения в социальных сетях, макроэкономические индикаторы;'),
        bullet('Поддержка альтернативных моделей Ollama: Llama 3.1, Mistral Nemo, Gemma 2.'),
        // ═══════════════════════════════════════════════════════════════
        // СПИСОК ИСТОЧНИКОВ
        // ═══════════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle('СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ'),
        numbered('Next.js Documentation. App Router. Vercel, 2024. — URL: https://nextjs.org/docs'),
        numbered('Firebase Authentication Documentation. Google, 2024. — URL: https://firebase.google.com/docs/auth'),
        numbered('Neon Serverless PostgreSQL Documentation. Neon, 2024. — URL: https://neon.tech/docs'),
        numbered('Ollama — Run Large Language Models Locally. — URL: https://ollama.com'),
        numbered('KLineCharts v9 Documentation. — URL: https://klinecharts.com'),
        numbered('Binance Futures API Documentation. Binance, 2024. — URL: https://binance-docs.github.io/apidocs/futures/en/'),
        numbered('Nakamoto S. Bitcoin: A Peer-to-Peer Electronic Cash System. — 2008. — URL: https://bitcoin.org/bitcoin.pdf'),
        numbered('Wilder J.W. New Concepts in Technical Trading Systems. Trend Research, 1978. — 144 p.'),
        numbered('Murphy J.J. Technical Analysis of the Financial Markets. New York Institute of Finance, 1999. — 576 p.'),
        numbered('Goodfellow I., Bengio Y., Courville A. Deep Learning. MIT Press, 2016. — 800 p.'),
        numbered('@neondatabase/serverless. npm Registry. — URL: https://www.npmjs.com/package/@neondatabase/serverless'),
        numbered('Qwen3 Technical Report. Alibaba Cloud, 2025. — URL: https://qwenlm.github.io/blog/qwen3/'),
        numbered('rss-parser. npm Registry. — URL: https://www.npmjs.com/package/rss-parser'),
        numbered('TypeScript Documentation. Microsoft, 2024. — URL: https://www.typescriptlang.org/docs/'),
        numbered('React 18 Documentation. Meta, 2024. — URL: https://react.dev'),
        // ═══════════════════════════════════════════════════════════════
        // ПРИЛОЖЕНИЕ А
        // ═══════════════════════════════════════════════════════════════
        new Paragraph({ children: [new PageBreak()] }),
        sectionTitle('ПРИЛОЖЕНИЕ А'),
        sectionTitle('ЛИСТИНГИ КЛЮЧЕВЫХ ФАЙЛОВ'),
        h2('А.1 Листинг: lib/ollama.ts (фрагмент — extractJSON и technicalAnalysis)'),
        code('// Очистка thinking-блоков qwen3 перед парсингом JSON'),
        code('function extractJSON(text: string): Record<string, unknown> {'),
        code('  const cleaned = text'),
        code('    .replace(/<think>[\\s\\S]*?<\\/think>/gi, \'\')'),
        code('    .trim()'),
        code('  const match ='),
        code('    cleaned.match(/```json\\s*([\\s\\S]*?)```/) ||'),
        code('    cleaned.match(/(\\{[\\s\\S]*\\})/)'),
        code('  if (!match) throw new Error(\'No JSON found in response\')'),
        code('  return JSON.parse(match[1])'),
        code('}'),
        code(''),
        code('export async function technicalAnalysis('),
        code('  pair: string, tf: string, market: MarketData'),
        code('): Promise<Step1Result> {'),
        code('  const prompt = `Ты опытный технический аналитик...'),
        code('  RSI(14): ${market.rsi}'),
        code('  MACD: ${market.macdSignal}'),
        code('  EMA50: цена ${market.priceVsEma50}'),
        code('  Верни ТОЛЬКО JSON: {signal, strength, trend, summary}`'),
        code('  const raw = await generate(TEXT_MODEL, prompt)'),
        code('  const json = extractJSON(raw)'),
        code('  return { signal: String(json.signal || \'WAIT\'), ... }'),
        code('}'),
        h2('А.2 Листинг: lib/db.ts (фрагмент — Proxy fix и schema)'),
        code('// Правильная инициализация Proxy с функцией как target'),
        code('// (необходимо для работы tagged template literals sql`...`)'),
        code('export const sql: NeonQueryFunction<false, false> ='),
        code('  new Proxy(function () {} as any, {'),
        code('    apply(_t, _this, args) {'),
        code('      return (getSQL() as any)(...args)'),
        code('    },'),
        code('    get(_t, prop) {'),
        code('      return (getSQL() as any)[prop]'),
        code('    },'),
        code('  })'),
        code(''),
        code('// Инициализация схемы БД (выполняется при первом запросе)'),
        code('export async function initDB() {'),
        code('  await sql`CREATE TABLE IF NOT EXISTS users (`'),
        code('  await sql`CREATE TABLE IF NOT EXISTS signals (id SERIAL PRIMARY KEY, ...)`'),
        code('  await sql`CREATE TABLE IF NOT EXISTS trades (...)`'),
        code('  await sql`CREATE TABLE IF NOT EXISTS notifications (...)`'),
        code('}'),
        h2('А.3 Листинг: KLineChartComponent.tsx (фрагмент — инициализация)'),
        code('import * as klinecharts from \'klinecharts\''),
        code('import { LineType } from \'klinecharts\''),
        code(''),
        code('// Прямой импорт из npm исключает зависимость от CDN'),
        code('// и обеспечивает строгую TypeScript-типизацию'),
        code(''),
        code('function initChart() {'),
        code('  if (chartRef.current || !containerRef.current) return'),
        code('  chartRef.current = klinecharts.init(\'kline-container\', {'),
        code('    styles: {'),
        code('      grid: {'),
        code('        horizontal: { style: LineType.Dashed, color: \'#1a1a1a\' },'),
        code('        vertical:   { style: LineType.Dashed, color: \'#1a1a1a\' },'),
        code('      },'),
        code('      candle: {'),
        code('        bar: { upColor: \'#00e676\', downColor: \'#ff3d57\' }'),
        code('      }'),
        code('    }'),
        code('  })'),
        code('  chartRef.current.createIndicator(\'VOL\', false, { id: \'vol_pane\' })'),
        code('  onReadyRef.current?.()'),
        code('}'),
        h2('А.4 Листинг: trades/[id]/close/route.ts — автоматический расчёт PnL'),
        code('export async function PATCH(req, { params }) {'),
        code('  const user = await getUser(req)'),
        code('  if (!user) return NextResponse.json({ error: \'Unauthorized\' }, { status: 401 })'),
        code(''),
        code('  const { pnl, pnl_pct } = await req.json().catch(() => ({}))'),
        code('  let finalPnl = pnl ?? null'),
        code(''),
        code('  // Автоматический расчёт PnL если не передан'),
        code('  if (finalPnl === null) {'),
        code('    const trade = await getTradeById(parseInt(params.id), user.id)'),
        code('    if (trade?.entry_price && trade.status === \'open\') {'),
        code('      const sym = trade.pair.replace(\'/\', \'\')'),
        code('      const r = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`)'),
        code('      const { price } = await r.json()'),
        code('      const dir = trade.direction === \'long\' ? 1 : -1'),
        code('      const pnlPct = ((price - entry) / entry) * 100 * dir * trade.leverage'),
        code('      finalPnl = (pnlPct / 100) * trade.amount'),
        code('    }'),
        code('  }'),
        code(''),
        code('  await closeTrade(parseInt(params.id), user.id, finalPnl, finalPnlPct)'),
        code('  return NextResponse.json({ ok: true, pnl: finalPnl })'),
        code('}'),
      ]
    }
  ]
});

// Генерация файла
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('D:/Проект 2.0/KotvukAI_Отчёт.docx', buffer);
  console.log('SUCCESS: KotvukAI_Отчёт.docx создан!');
  const stats = fs.statSync('D:/Проект 2.0/KotvukAI_Отчёт.docx');
  console.log('Размер файла: ' + Math.round(stats.size / 1024) + ' KB');
}).catch(err => {
  console.error('ERROR:', err.message);
});
