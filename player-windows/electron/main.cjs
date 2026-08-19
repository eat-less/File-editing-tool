const { app, BrowserWindow, ipcMain, protocol, net, screen } = require('electron')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('force-device-scale-factor', '1')

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'application/octet-stream': 'bin',
}

function mimeToExt(mime) {
  if (!mime) return 'bin'
  const lower = mime.toLowerCase()
  for (const [k, v] of Object.entries(MIME_EXT)) {
    if (lower.includes(k)) return v
  }
  if (lower.includes('jpeg')) return 'jpg'
  return 'bin'
}

let mainWindow = null

function cacheDir() {
  return path.join(app.getPath('userData'), 'media-cache')
}

function stateFile() {
  return path.join(app.getPath('userData'), 'state.json')
}

function configPath() {
  if (app.isPackaged) return path.join(app.getPath('userData'), 'player.config.json')
  return path.join(app.getAppPath(), 'player.config.json')
}

function ensureDirs() {
  fs.mkdirSync(cacheDir(), { recursive: true })
}

function readConfig() {
  const p = configPath()
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return { serverUrl: 'http://127.0.0.1:8000', deviceCode: 'DEV-001' }
  }
}

function lookupMediaPath(hash) {
  const bare = path.join(cacheDir(), hash)
  if (fs.existsSync(bare)) return bare
  try {
    const dir = fs.readdirSync(cacheDir())
    const f = dir.find(name => name.startsWith(hash + '.'))
    if (f) return path.join(cacheDir(), f)
  } catch {}
  return null
}

function registerMediaProtocol() {
  protocol.handle('media', (request) => {
    try {
      const u = new URL(request.url)
      const hash = u.hostname === 'assets' ? u.pathname.replace(/^\//, '') : u.host
      const file = lookupMediaPath(hash)
      if (!file) return new Response('Not Found', { status: 404 })
      return net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('Bad Request', { status: 400 })
    }
  })
}

function getLocalIp() {
  const ifaces = os.networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) return info.address
    }
  }
  return ''
}

function registerIpc() {
  ipcMain.handle('config:get', () => readConfig())

  ipcMain.handle('ip:get', () => getLocalIp())

  ipcMain.handle('cache:exists', (_e, hash) => !!lookupMediaPath(hash))

  ipcMain.handle('cache:write', (_e, { hash, data, mime }) => {
    try {
      ensureDirs()
      const ext = mimeToExt(mime)
      const target = path.join(cacheDir(), `${hash}.${ext}`)
      fs.writeFileSync(target, Buffer.from(data))
      return { ok: true, size: data.byteLength || data.length }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('cache:list', () => {
    try {
      const dir = fs.readdirSync(cacheDir())
      return dir.map(name => ({ name, size: fs.statSync(path.join(cacheDir(), name)).size }))
    } catch {
      return []
    }
  })

  ipcMain.handle('cache:clear', () => {
    try {
      fs.rmSync(cacheDir(), { recursive: true, force: true })
      fs.mkdirSync(cacheDir(), { recursive: true })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('state:read', () => {
    try {
      const raw = JSON.parse(fs.readFileSync(stateFile(), 'utf-8'))
      if (raw.programId && !raw.programs) {
        return { programs: { [raw.programId]: raw }, activeProgramId: raw.programId }
      }
      return raw
    } catch {
      return { programs: {}, activeProgramId: null }
    }
  })

  ipcMain.handle('state:write', (_e, payload) => {
    try {
      const { programId } = payload
      if (!programId) return { ok: false, error: 'missing programId' }
      let state
      try {
        state = JSON.parse(fs.readFileSync(stateFile(), 'utf-8'))
        if (!state.programs) state = { programs: {}, activeProgramId: null }
      } catch {
        state = { programs: {}, activeProgramId: null }
      }
      state.programs[programId] = payload
      state.activeProgramId = programId
      fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('window:toggleFullscreen', () => {
    if (!mainWindow) return
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
  })
}

function createWindow() {
  ensureDirs()
  const display = screen.getPrimaryDisplay()
  const { x, y, width, height } = display.bounds
  console.log('[main] displays:', JSON.stringify(screen.getAllDisplays()))
  console.log('[main] primary display:', JSON.stringify(display))

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.setMenuBarVisibility(false)

  function forceFullscreen(tag) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
      if (!mainWindow.isFullScreen()) mainWindow.setFullScreen(true)
    } catch (err) {
      console.log('[main] setFullScreen error:', err)
    }
    const cur = mainWindow.getBounds()
    const disp = screen.getDisplayMatching(cur)
    const b = disp.bounds
    if (!mainWindow.isFullScreen() && (cur.width !== b.width || cur.height !== b.height)) {
      try { mainWindow.setBounds(b) } catch (err) { console.log('[main] setBounds error:', err) }
    }
    console.log(`[main] ${tag}: isFullScreen=${mainWindow.isFullScreen()} bounds=${JSON.stringify(mainWindow.getBounds())} display=${JSON.stringify(b)}`)
  }

  mainWindow.on('enter-full-screen', () => console.log('[main] enter-full-screen event'))
  mainWindow.on('leave-full-screen', () => console.log('[main] leave-full-screen event'))

  mainWindow.once('ready-to-show', () => {
    forceFullscreen('ready-to-show')
    setTimeout(() => forceFullscreen('t+800ms'), 800)
    setTimeout(() => forceFullscreen('t+3000ms'), 3000)
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    registerMediaProtocol()
    createWindow()
    app.setLoginItemSettings({ openAtLogin: false })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  app.quit()
})
