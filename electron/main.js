'use strict'

const { app, BrowserWindow, shell, Menu, dialog, session, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const crypto = require('crypto')

const PORT = 3000
const DEV_MODE = process.env.NODE_ENV === 'development'

let mainWindow = null
let nextProcess = null
let splashWindow = null

// Load .env.local into process.env so Next.js server gets the vars
function loadEnv() {
  const envPath = DEV_MODE
    ? path.join(__dirname, '..', '.env.local')
    : path.join(process.resourcesPath, '.env.local')

  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (!process.env[key]) process.env[key] = val
  }
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: false,
    resizable: false,
    center: true,
    backgroundColor: '#0e0e10',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  const splashHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0e0e10;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; user-select: none;
  }
  .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px; }
  .logo span { color: #00d4ff; }
  .sub { font-size: 13px; color: #666; margin-bottom: 32px; }
  .bar-wrap { width: 260px; height: 3px; background: #1e1e22; border-radius: 2px; overflow: hidden; }
  .bar { height: 100%; width: 0%; background: linear-gradient(90deg, #00d4ff, #00e676);
    border-radius: 2px; animation: load 8s ease-in-out forwards; }
  @keyframes load { 0%{width:0%} 30%{width:40%} 70%{width:75%} 100%{width:95%} }
  .status { margin-top: 16px; font-size: 12px; color: #555; }
</style>
</head>
<body>
  <div class="logo">KOTVUK<span>AI</span></div>
  <div class="sub">AI-платформа для криптотрейдеров</div>
  <div class="bar-wrap"><div class="bar"></div></div>
  <div class="status">Запуск сервера...</div>
</body>
</html>`

  const tmpHtml = path.join(app.getPath('temp'), 'kotvukai-splash.html')
  fs.writeFileSync(tmpHtml, splashHtml)
  splashWindow.loadFile(tmpHtml)
  splashWindow.show()
}

function startNextServer() {
  const isPackaged = app.isPackaged

  let nextScript, cwd, args

  if (isPackaged) {
    // electron-builder removes node_modules/.bin — use Next.js CLI script directly.
    // ELECTRON_RUN_AS_NODE=1 makes Electron act as a plain Node.js runtime.
    nextScript = path.join(process.resourcesPath, 'app', 'node_modules', 'next', 'dist', 'bin', 'next')
    cwd = path.join(process.resourcesPath, 'app')
    args = ['start', '--port', String(PORT)]
  } else {
    // Dev mode: next binary available via node_modules/.bin
    nextScript = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')
    cwd = path.join(__dirname, '..')
    args = ['dev', '--port', String(PORT)]
  }

  // Spawn Electron itself as a Node.js runtime via ELECTRON_RUN_AS_NODE=1.
  // This avoids any dependency on cmd.exe, .bin wrappers, or external node.exe.
  const spawnCmd = process.execPath
  const spawnArgs = [nextScript, ...args]
  const spawnOpts = {
    cwd,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  }

  nextProcess = spawn(spawnCmd, spawnArgs, spawnOpts)

  nextProcess.stdout.on('data', d => {
    const text = d.toString()
    console.log('[Next]', text.trim())
    if (text.includes('Ready') || text.includes('started server') || text.includes('Local:')) {
      onServerReady()
    }
  })

  nextProcess.stderr.on('data', d => console.error('[Next err]', d.toString().trim()))
  nextProcess.on('error', err => {
    console.error('Failed to start Next.js:', err)
    dialog.showErrorBox('Ошибка запуска', `Не удалось запустить сервер: ${err.message}`)
    app.quit()
  })
}

function waitForServer(retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`http://localhost:${PORT}`, (res) => {
        res.destroy()
        resolve()
      })
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Server did not start in time'))
        setTimeout(() => attempt(n - 1), delay)
      })
      req.setTimeout(800, () => { req.destroy() })
    }
    attempt(retries)
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#0e0e10',
    title: 'KotvukAI',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  })

  // Remove default menu, keep minimal
  const menu = Menu.buildFromTemplate([
    {
      label: 'KotvukAI',
      submenu: [
        { label: 'Перезагрузить', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { type: 'separator' },
        { label: 'Выйти', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  // Open external links in browser, not Electron
  // But allow Google OAuth popups inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.includes('accounts.google.com') ||
      url.includes('firebaseapp.com/__/auth') ||
      url.includes('googleapis.com')
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 650,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        },
      }
    }
    if (!url.startsWith('http://localhost')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // Override UA on any popup windows (Google OAuth) immediately after creation
  mainWindow.webContents.on('did-create-window', (popup) => {
    popup.webContents.userAgent = CHROME_UA
  })

  mainWindow.on('closed', () => { mainWindow = null })

  return mainWindow
}

function onServerReady() {
  if (mainWindow && mainWindow.isVisible()) return

  const win = mainWindow || createMainWindow()
  win.loadURL(`http://localhost:${PORT}`)

  win.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    win.show()
    win.focus()
  })
}

// ─── Google OAuth via system browser (PKCE, no popup) ───────────────────────

const OAUTH_PORT = 3005

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request(
      { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => { let s = ''; res.on('data', c => { s += c }); res.on('end', () => { try { resolve(JSON.parse(s)) } catch (e) { reject(e) } }) }
    )
    req.on('error', reject); req.write(data); req.end()
  })
}

// Step 1 — ask Firebase REST API for the Google OAuth URL (gets us client_id)
async function getGoogleAuthUrl(apiKey) {
  const res = await httpsPost('identitytoolkit.googleapis.com', `/v1/accounts:createAuthUri?key=${apiKey}`, {
    providerId: 'google.com',
    continueUri: `http://localhost:${OAUTH_PORT}/callback`,
  })
  if (!res.authUri) throw new Error(res.error?.message || 'createAuthUri failed')
  return res.authUri // e.g. https://accounts.google.com/o/oauth2/auth?client_id=...
}

// Step 2 — rebuild the URL with PKCE + localhost redirect
function buildPkceUrl(originalUrl) {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const u = new URL(originalUrl)

  // Replace redirect_uri to our local callback
  u.searchParams.set('redirect_uri', `http://localhost:${OAUTH_PORT}/callback`)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.delete('response_type') // remove implicit flow
  u.searchParams.set('response_type', 'code')

  return { url: u.toString(), verifier, clientId: u.searchParams.get('client_id') }
}

// Step 3 — local HTTP server catches the ?code=... from Google
function waitForCode(verifier, clientId) {
  return new Promise((resolve, reject) => {
    let done = false
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, `http://localhost:${OAUTH_PORT}`)
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return }

      const code = u.searchParams.get('code')
      const error = u.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html><html><body style="background:#0e0e10;color:#fff;font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#00d4ff">${error ? '✗ Ошибка' : '✓ Авторизация выполнена!'}</h2>
        <p>${error || 'Можно закрыть это окно и вернуться в KotvukAI.'}</p></body></html>`)

      if (done) return
      done = true
      server.close()

      if (error) { reject(new Error(error)); return }
      if (!code) { reject(new Error('No code received')); return }

      // Step 4 — exchange code for tokens (PKCE, no client_secret needed)
      try {
        const tokens = await httpsPost('oauth2.googleapis.com', '/token', {
          code, client_id: clientId, redirect_uri: `http://localhost:${OAUTH_PORT}/callback`,
          code_verifier: verifier, grant_type: 'authorization_code',
        })
        if (tokens.error) throw new Error(tokens.error_description || tokens.error)
        resolve({ idToken: tokens.id_token, accessToken: tokens.access_token })
      } catch (e) { reject(e) }
    })

    server.listen(OAUTH_PORT, () => {})
    server.on('error', reject)
    setTimeout(() => { if (!done) { done = true; server.close(); reject(new Error('OAuth timeout')) } }, 300000)
  })
}

ipcMain.handle('google-oauth-start', async () => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey) return { success: false, error: 'NEXT_PUBLIC_FIREBASE_API_KEY not set' }
  try {
    const authUri = await getGoogleAuthUrl(apiKey)
    const { url, verifier, clientId } = buildPkceUrl(authUri)
    const codePromise = waitForCode(verifier, clientId)
    shell.openExternal(url)
    const tokens = await codePromise
    return { success: true, ...tokens }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─────────────────────────────────────────────────────────────────────────────

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Override UA at Chromium level BEFORE app is ready — most effective
app.commandLine.appendSwitch('user-agent', CHROME_UA)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.userAgentFallback = CHROME_UA

app.whenReady().then(async () => {
  loadEnv()

  // Override sec-ch-ua headers for Google OAuth domains so they look like real Chrome
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.google.com/*', '*://*.googleapis.com/*', '*://*.firebaseapp.com/*'] },
    (details, callback) => {
      const h = details.requestHeaders
      h['User-Agent'] = CHROME_UA
      h['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
      h['sec-ch-ua-mobile'] = '?0'
      h['sec-ch-ua-platform'] = '"Windows"'
      delete h['sec-fetch-dest']
      callback({ requestHeaders: h })
    }
  )

  createSplash()

  // Always try existing server first (covers: dev mode, already-running instances)
  const serverAlreadyUp = await waitForServer(3, 500).then(() => true).catch(() => false)

  if (serverAlreadyUp) {
    onServerReady()
  } else {
    startNextServer()
    try {
      await waitForServer(60, 1000)
      onServerReady()
    } catch (e) {
      dialog.showErrorBox('Ошибка запуска', 'Next.js сервер не отвечает. Попробуйте перезапустить.')
      app.quit()
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) onServerReady()
})

app.on('before-quit', () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill()
  }
})
