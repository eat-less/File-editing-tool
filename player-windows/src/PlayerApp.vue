<template>
  <div class="player-app">
    <PlayerStage
      v-if="config"
      ref="stageRef"
      :config="config"
      :asset-url="assetUrl"
      :fill="true"
      :on-cross-device="onCrossDevice"
      :on-state="onState"
    />

    <div v-if="stage === 'playing' && config" class="player-nav" :class="{ dim: navHidden }" @mouseenter="pokeNav">
      <button class="nav-btn nav-prev" @click.stop="goPrev" :disabled="pageCount <= 1">&lt;</button>
      <span v-if="navShowIndicator" class="nav-indicator">{{ currentIndex + 1 }} / {{ pageCount }}</span>
      <button class="nav-btn nav-next" @click.stop="goNext" :disabled="pageCount <= 1">&gt;</button>
    </div>

    <div v-if="stage === 'booting'" class="overlay">
      <div class="logo-box">
        <div class="logo-text">多媒体播放器</div>
        <div class="logo-sub">Multimedia Player</div>
      </div>
      <div class="copyright">© {{ year }} 版权所有</div>
    </div>

    <div v-else-if="stage === 'waiting'" class="overlay">
      <div class="status-text">等待配置</div>
      <div class="status-hint">请先在管理端为本设备编辑并导出节目</div>
      <div class="status-hint small">设备IP：{{ deviceIp || '未知' }}</div>
      <div class="status-hint small">服务器：{{ serverUrl || '未知' }}</div>
      <div v-if="configPath" class="status-hint small">配置文件：{{ configPath }}</div>
      <button class="link-btn" style="margin-top:18px" @click="openSettings">设备设置</button>
      <div class="hint-small" style="margin-top:8px">按 F2 也可打开设置</div>
    </div>

    <div v-else-if="stage === 'downloading'" class="overlay">
      <div class="status-text">正在同步内容…</div>
      <div class="progress-bar"><div class="progress-inner" :style="{ width: progress + '%' }"></div></div>
      <div class="status-hint small">{{ progress }}% ({{ progressDone }}/{{ progressTotal }})</div>
    </div>

    <div v-else-if="stage === 'offline'" class="overlay">
      <div class="status-text">无法连接服务器</div>
      <div class="status-hint">正在自动重连…</div>
      <button class="link-btn" style="margin-top:18px" @click="openSettings">设备设置</button>
    </div>

    <div v-else-if="stage === 'error'" class="overlay">
      <div class="status-text">播放异常</div>
      <div class="status-hint">{{ errorMsg }}</div>
    </div>

    <div v-if="showSettings" class="settings-mask" @mousedown.stop @touchstart.stop>
      <div class="settings-card">
        <div class="settings-title">设备设置</div>

        <div class="settings-field">
          <div class="settings-row-inline">
            <span class="settings-label">开机自启动</span>
            <label class="switch">
              <input type="checkbox" v-model="autoStart" />
              <span class="slider"></span>
            </label>
            <span class="settings-note">{{ autoStart ? '已开启：登录 Windows 后自动运行播放器' : '已关闭' }}</span>
          </div>
        </div>

        <div class="settings-field">
          <div class="settings-label">本机 IP 地址</div>
          <div class="settings-note">请选择与管理端登记一致的本机网卡 IP（服务器按此 IP 识别本设备）：</div>
          <div v-if="ipOptions.length === 0" class="settings-note warn">未检测到可用 IP，请检查网卡/网络连接后点击“刷新网卡列表”</div>
          <div class="ip-options">
            <label v-for="opt in ipOptions" :key="opt.address" class="ip-option" :class="{ active: selectedIp === opt.address }">
              <input type="radio" name="deviceIp" :value="opt.address" v-model="selectedIp" />
              <span class="ip-name">{{ opt.name }}</span>
              <span class="ip-address">{{ opt.address }}</span>
            </label>
          </div>
          <button class="link-btn" @click="refreshIpList">刷新网卡列表</button>
        </div>

        <div class="settings-field">
          <div class="settings-label">服务器地址</div>
          <input v-model="serverInput" class="text-input" placeholder="http://192.168.1.100:8000" spellcheck="false" />
        </div>

        <div class="settings-actions">
          <button class="btn primary" :disabled="!selectedIp" @click="saveSettings">保存并启动</button>
          <button class="btn" @click="skipSettings">稍后再说</button>
        </div>
        <div class="hint-small" style="margin-top:12px;text-align:center">设置保存到：{{ configPath || '本机配置文件' }}（按 ESC / F2 关闭）</div>
      </div>
    </div>

    <div v-if="stage === 'playing' && onlineBadge" class="badge online">在线</div>
    <div v-else-if="stage === 'playing' && !onlineBadge" class="badge offline">离线播放</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import PlayerStage from '@/render-engine/PlayerStage.vue'
import { loadConfig } from './config.js'
import { createDeviceSocket } from './deviceSocket.js'
import { fetchSync, ensureAssets, assetsCached } from './playerService.js'
import { buildDeviceAction } from '@/utils/hotspotAction'

const stageRef = ref(null)
const stage = ref('booting')
const progress = ref(0)
const progressDone = ref(0)
const progressTotal = ref(0)
const config = ref(null)
const errorMsg = ref('')
const deviceIp = ref('')
const serverUrl = ref('')
const configPath = ref('')
const showSettings = ref(false)
const autoStart = ref(false)
const ipOptions = ref([])
const selectedIp = ref('')
const serverInput = ref('')
const year = new Date().getFullYear()
const onlineBadge = ref(false)
const currentIndex = ref(0)
const pageCount = ref(1)
const navHidden = ref(false)
const navShowIndicator = ref(true)
const currentScene = ref('')

let socket = null
let bootTimer = null
let offlineRetryTimer = null
let waitingRetryTimer = null
let syncPollTimer = null
let navTimer = null
let configRef = null
let everStarted = false
let syncing = false
let pendingSync = false
let retryAttempt = 0
const RETRY_MAX_DELAY = 60000
const SYNC_POLL_MS = 8000
let touchStartX = 0
let touchStartY = 0

function assetUrl(hash) {
  return `media://assets/${hash}`
}

function onCrossDevice(hotspot) {
  if (!socket || !configRef) return
  const msg = buildDeviceAction(hotspot, deviceIp.value)
  socket.sendDeviceAction(msg)
}

function onState(state) {
  currentIndex.value = state.pageIndex
  pageCount.value = state.pageCount
  if (socket) socket.reportStatus(state.pageIndex, currentScene.value)
  pokeNav()
}

function pokeNav() {
  navHidden.value = false
  navShowIndicator.value = true
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(() => {
    navHidden.value = true
    navShowIndicator.value = false
  }, 3000)
}

function goNext() {
  if (stage.value !== 'playing' || !stageRef.value) return
  stageRef.value.next()
  pokeNav()
}

function goPrev() {
  if (stage.value !== 'playing' || !stageRef.value) return
  stageRef.value.prev()
  pokeNav()
}

function clearNavTimer() {
  if (navTimer) { clearTimeout(navTimer); navTimer = null }
}

async function handleSync() {
  if (syncing) {
    // 同步进行中又来新通知(发布/轮询):不丢弃,结束后补跑一次
    pendingSync = true
    return
  }
  syncing = true
  clearOfflineRetry()
  clearWaitingRetry()
  try {
    if (!serverUrl.value) return
    const sync = await fetchSync(serverUrl.value, deviceIp.value)
    retryAttempt = 0
    if (!sync.published) {
      stage.value = 'waiting'
      waitingRetryTimer = setTimeout(handleSync, 20000)
      return
    }
    currentScene.value = sync.scene_id || ''
    const state = await window.playerAPI.stateRead().catch(() => null)
    const cachedProgram = state?.programs?.[sync.program_id]
    const sameVersion = !!(cachedProgram && cachedProgram.version === sync.version)
    const isActive = state?.activeProgramId === sync.program_id

    if (sameVersion && isActive && configRef) {
      socket?.reportSyncDone(sync.program_id, sync.version)
      ensureAssets(serverUrl.value, sync.assets || []).catch(() => {})
      return
    }

    if (sameVersion && cachedProgram?.config) {
      setConfig(cachedProgram.config)
      await window.playerAPI.stateWrite({
        programId: sync.program_id,
        programName: sync.program_name,
        version: sync.version,
        config: sync.config,
      })
      socket?.reportSyncDone(sync.program_id, sync.version)
      return
    }

    const allCached = sync.assets?.length ? await assetsCached(sync.assets) : true
    if (allCached && cachedProgram?.config) {
      setConfig(cachedProgram.config)
      await window.playerAPI.stateWrite({
        programId: sync.program_id,
        programName: sync.program_name,
        version: sync.version,
        config: sync.config,
      })
      socket?.reportSyncDone(sync.program_id, sync.version)
      return
    }

    stage.value = 'downloading'
    socket?.reportSyncStatus(sync.program_id, 0)
    await ensureAssets(serverUrl.value, sync.assets || [], (p) => {
      progress.value = p.percent
      progressDone.value = p.done
      progressTotal.value = p.total
      socket?.reportSyncStatus(sync.program_id, p.percent / 100)
    })
    await window.playerAPI.stateWrite({
      programId: sync.program_id,
      programName: sync.program_name,
      version: sync.version,
      config: sync.config,
    })
    socket?.reportSyncDone(sync.program_id, sync.version)
    setConfig(sync.config)
  } catch (err) {
    await tryOffline(err)
  } finally {
    syncing = false
    if (pendingSync) {
      pendingSync = false
      handleSync()
    }
  }
}

async function tryOffline(err) {
  console.warn('[player] sync failed, try offline:', err)
  let hasCache = false
  try {
    const state = await window.playerAPI.stateRead()
    if (state?.activeProgramId && state.programs?.[state.activeProgramId]?.config) {
      hasCache = true
      if (!configRef) setConfig(state.programs[state.activeProgramId].config)
      if (stage.value !== 'playing') stage.value = 'playing'
    }
  } catch {}
  if (!hasCache) stage.value = 'offline'
  // 缓存回放与离线页都持续自动重试(指数退避),服务器恢复后自动退出离线
  scheduleSyncRetry()
}

function setConfig(cfg) {
  configRef = cfg
  config.value = { device: cfg.device, pages: cfg.pages }
  stage.value = 'playing'
}

function handleCommand(msg) {
  if (msg.action === 'switchScene') {
    handleSync()
    return
  }
  if (!stageRef.value) return
  stageRef.value.executeAction(msg.action || '', msg.params || {})
  if (socket) socket.reportStatus(stageRef.value.getCurrentIndex(), currentScene.value)
}

function onConnectionChange(v) {
  onlineBadge.value = v
  if (v) {
    // 连接恢复后立即重新同步,退出离线态
    retryAttempt = 0
    handleSync()
    startSyncPoll()
  } else {
    // 断开时停止轮询,由离线退避重试负责
    stopSyncPoll()
  }
}

function startSyncPoll() {
  stopSyncPoll()
  syncPollTimer = setTimeout(function tick() {
    syncPollTimer = null
    handleSync()
    syncPollTimer = setTimeout(tick, SYNC_POLL_MS)
  }, SYNC_POLL_MS)
}

function stopSyncPoll() {
  if (syncPollTimer) { clearTimeout(syncPollTimer); syncPollTimer = null }
}

function clearOfflineRetry() {
  if (offlineRetryTimer) { clearTimeout(offlineRetryTimer); offlineRetryTimer = null }
}

function clearWaitingRetry() {
  if (waitingRetryTimer) { clearTimeout(waitingRetryTimer); waitingRetryTimer = null }
}

function scheduleSyncRetry() {
  clearOfflineRetry()
  const delay = Math.min(5000 * Math.pow(2, retryAttempt), RETRY_MAX_DELAY)
  retryAttempt++
  offlineRetryTimer = setTimeout(handleSync, delay)
}

function handleKeydown(e) {
  if (showSettings.value) {
    if (e.key === 'Escape' || e.key === 'F2') {
      e.preventDefault()
      closeSettings()
      if (!everStarted) startPlayer()
    }
    return
  }
  if (e.key === 'F2') {
    e.preventDefault()
    openSettings()
    return
  }
  if (e.key === 'Escape' && window.playerAPI && window.playerAPI.toggleFullscreen) {
    window.playerAPI.toggleFullscreen()
  }
  if (e.key === 'ArrowRight') goNext()
  if (e.key === 'ArrowLeft') goPrev()
}

function handleWheel(e) {
  if (showSettings.value) return
  if (e.deltaY > 0) goNext()
  else if (e.deltaY < 0) goPrev()
}

function handleTouchStart(e) {
  const t = e.changedTouches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}

function handleTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) goNext()
    else goPrev()
  }
}

function closeSettings() {
  showSettings.value = false
}

async function getIpOptions() {
  if (window.playerAPI && window.playerAPI.getIpList) {
    return (await window.playerAPI.getIpList()) || []
  }
  return []
}

async function refreshIpList() {
  const list = await getIpOptions()
  ipOptions.value = list
  if (!selectedIp.value && list.length) {
    selectedIp.value = list.some(o => o.address === deviceIp.value) ? deviceIp.value : list[0].address
  }
  return list
}

async function openSettings() {
  showSettings.value = true
  let cfg = null
  try { cfg = await loadConfig() } catch {}
  cfg = cfg || {}
  autoStart.value = !!cfg.autoStart
  const srv = (cfg.serverUrl || serverUrl.value || 'http://127.0.0.1:8000').replace(/\/+$/, '')
  serverInput.value = srv
  await refreshIpList()
}

async function persistConfig(patch) {
  if (window.playerAPI && window.playerAPI.setConfig) {
    return await window.playerAPI.setConfig(patch)
  }
  return null
}

async function saveSettings() {
  if (!selectedIp.value) return
  const server = (serverInput.value || serverUrl.value || '').replace(/\/+$/, '')
  await persistConfig({ autoStart: autoStart.value, ip: selectedIp.value, serverUrl: server, configured: true })
  deviceIp.value = selectedIp.value
  if (server) serverUrl.value = server
  showSettings.value = false
  startPlayer()
}

async function skipSettings() {
  const server = (serverInput.value || serverUrl.value || '').replace(/\/+$/, '')
  await persistConfig({ autoStart: autoStart.value, serverUrl: server, configured: true })
  if (server) serverUrl.value = server
  showSettings.value = false
  startPlayer()
}

function stopSocket() {
  if (socket) { socket.stop(); socket = null }
}

function startPlayer() {
  everStarted = true
  retryAttempt = 0
  if (bootTimer) { clearTimeout(bootTimer); bootTimer = null }
  clearOfflineRetry()
  clearWaitingRetry()
  stopSyncPoll()
  stopSocket()
  const ip = deviceIp.value
  if (!ip) {
    stage.value = 'waiting'
    return
  }
  window.playerAPI.stateRead().catch(() => null).then(state => {
    if (!configRef && state?.activeProgramId && state.programs?.[state.activeProgramId]?.config) {
      setConfig(state.programs[state.activeProgramId].config)
    }
  })
  bootTimer = setTimeout(() => {
    socket = createDeviceSocket({
      serverUrl: serverUrl.value,
      deviceId: ip,
      ipAddress: ip,
      onUpdate: handleSync,
      onCommand: handleCommand,
      onConnectionChange,
    })
    handleSync()
  }, 800)
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('wheel', handleWheel, { passive: true })
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  window.addEventListener('touchend', handleTouchEnd, { passive: true })

  let cfg = null
  try { cfg = await loadConfig() } catch {}
  cfg = cfg || {}
  serverUrl.value = (cfg.serverUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '')
  serverInput.value = serverUrl.value
  autoStart.value = !!cfg.autoStart
  if (window.playerAPI && window.playerAPI.getConfigPath) {
    configPath.value = (await window.playerAPI.getConfigPath()) || ''
  }
  ipOptions.value = await getIpOptions()
  deviceIp.value = (cfg.ip && cfg.ip.trim()) ? cfg.ip.trim() : (ipOptions.value[0]?.address || '')

  if (!cfg.configured && !cfg.ip) {
    // 首次运行:弹出设置,让用户选择开机自启动与本机 IP
    selectedIp.value = deviceIp.value
    showSettings.value = true
    return
  }
  startPlayer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchend', handleTouchEnd)
  clearNavTimer()
  if (bootTimer) clearTimeout(bootTimer)
  clearOfflineRetry()
  clearWaitingRetry()
  stopSyncPoll()
  if (socket) socket.stop()
})
</script>

<style>
.player-app {
  position: absolute;
  inset: 0;
  background: #000;
  color: #fff;
  font-family: 'Microsoft YaHei', sans-serif;
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #000;
  z-index: 10;
}
.logo-box { text-align: center; }
.logo-text { font-size: 56px; font-weight: bold; letter-spacing: 6px; color: #fff; }
.logo-sub { font-size: 18px; color: #888; letter-spacing: 2px; margin-top: 8px; }
.copyright { position: absolute; bottom: 24px; font-size: 13px; color: #555; }
.status-text { font-size: 34px; color: #ccc; }
.status-hint { font-size: 16px; color: #888; margin-top: 12px; }
.status-hint.small { font-size: 13px; color: #666; }
.progress-bar { width: 420px; height: 6px; background: #222; border-radius: 3px; margin-top: 24px; overflow: hidden; }
.progress-inner { height: 100%; background: #409eff; border-radius: 3px; transition: width 0.3s; }
.badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
  color: #bbb;
}
.badge.online { color: #67c23a; }
.badge.offline { color: #e6a23c; }
.player-nav {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 20px;
  z-index: 30;
  transition: opacity 0.3s;
}
.player-nav.dim { opacity: 0.2; }
.player-nav .nav-btn {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.45);
  color: #fff;
  border-radius: 50%;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.player-nav .nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.55); }
.player-nav .nav-btn:disabled { opacity: 0.25; cursor: default; }
.player-nav .nav-indicator { color: rgba(255,255,255,0.75); font-size: 15px; min-width: 70px; text-align: center; }

.settings-mask {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
}
.settings-card {
  width: 560px;
  max-width: 92vw;
  max-height: 88vh;
  overflow: auto;
  background: #101018;
  border: 1px solid #2c2c3a;
  border-radius: 12px;
  padding: 26px 30px;
  color: #eee;
  box-shadow: 0 12px 40px rgba(0,0,0,0.6);
}
.settings-title { font-size: 22px; font-weight: bold; margin-bottom: 20px; letter-spacing: 1px; }
.settings-field { margin-bottom: 20px; }
.settings-row-inline { display: flex; align-items: center; gap: 14px; }
.settings-label { font-size: 16px; font-weight: bold; }
.settings-note { font-size: 13px; color: #9a9aa8; line-height: 1.6; }
.settings-note.warn { color: #e6a23c; }
.hint-small { font-size: 12px; color: #666; }
.link-btn {
  background: none;
  border: none;
  color: #409eff;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-top: 8px;
}
.link-btn:hover { text-decoration: underline; }
.text-input {
  width: 100%;
  box-sizing: border-box;
  background: #1c1c28;
  border: 1px solid #33334a;
  border-radius: 6px;
  color: #eee;
  font-size: 15px;
  padding: 9px 12px;
  margin-top: 8px;
}
.switch { position: relative; display: inline-block; width: 46px; height: 24px; flex: none; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch .slider {
  position: absolute;
  inset: 0;
  background: #3a3a4c;
  border-radius: 24px;
  transition: background 0.2s;
}
.switch .slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.switch input:checked + .slider { background: #409eff; }
.switch input:checked + .slider::before { transform: translateX(22px); }
.ip-options { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.ip-option {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #33334a;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.ip-option:hover { border-color: #409eff; }
.ip-option.active { border-color: #409eff; background: rgba(64,158,255,0.12); }
.ip-option .ip-name { color: #ccc; font-size: 14px; }
.ip-option .ip-address { margin-left: auto; font-family: Consolas, monospace; font-size: 14px; color: #fff; }
.settings-actions { display: flex; gap: 14px; margin-top: 22px; }
.btn {
  flex: 1;
  padding: 11px 0;
  font-size: 15px;
  border-radius: 6px;
  border: 1px solid #33334a;
  background: #1c1c28;
  color: #eee;
  cursor: pointer;
}
.btn.primary { background: #409eff; border-color: #409eff; color: #fff; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
