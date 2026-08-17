<template>
  <div class="player-app">
    <PlayerStage
      v-if="config"
      ref="stageRef"
      :config="config"
      :asset-url="assetUrl"
      :on-cross-device="onCrossDevice"
      :on-state="onState"
    />

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
      <div class="status-hint small">设备编码：{{ deviceCode }}</div>
    </div>

    <div v-else-if="stage === 'downloading'" class="overlay">
      <div class="status-text">正在同步内容…</div>
      <div class="progress-bar"><div class="progress-inner" :style="{ width: progress + '%' }"></div></div>
      <div class="status-hint small">{{ progress }}% ({{ progressDone }}/{{ progressTotal }})</div>
    </div>

    <div v-else-if="stage === 'offline'" class="overlay">
      <div class="status-text">无法连接服务器</div>
      <div class="status-hint">正在自动重连…</div>
    </div>

    <div v-else-if="stage === 'error'" class="overlay">
      <div class="status-text">播放异常</div>
      <div class="status-hint">{{ errorMsg }}</div>
    </div>

    <div v-if="onlineBadge" class="badge online">在线</div>
    <div v-else-if="offlineBadge && stage === 'playing'" class="badge offline">离线播放</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import PlayerStage from '@/render-engine/PlayerStage.vue'
import { loadConfig } from './config.js'
import { createDeviceSocket } from './deviceSocket.js'
import { fetchSync, ensureAssets } from './playerService.js'
import { buildDeviceAction } from '@/utils/hotspotAction'

const stageRef = ref(null)
const stage = ref('booting')
const progress = ref(0)
const progressDone = ref(0)
const progressTotal = ref(0)
const config = ref(null)
const errorMsg = ref('')
const deviceCode = ref('DEV-001')
const serverUrl = ref('')
const year = new Date().getFullYear()
const onlineBadge = ref(false)
const offlineBadge = ref(false)

let socket = null
let bootTimer = null
let offlineRetryTimer = null
let configRef = null

function assetUrl(hash) {
  return `media://assets/${hash}`
}

function onCrossDevice(hotspot) {
  if (!socket || !configRef) return
  const msg = buildDeviceAction(hotspot, deviceCode.value)
  socket.sendDeviceAction(msg)
}

function onState(state) {
  if (socket) socket.reportStatus(state.pageIndex, '')
}

async function handleSync() {
  clearOfflineRetry()
  if (!serverUrl.value) return
  try {
    const sync = await fetchSync(serverUrl.value, deviceCode.value)
    if (!sync.published) {
      stage.value = 'waiting'
      return
    }
    const cached = await window.playerAPI.stateRead().catch(() => null)
    const sameVersion = !!(cached && cached.programId === sync.program_id && cached.version === sync.version)

    if (sameVersion && configRef) {
      socket?.reportSyncDone(sync.program_id, sync.version)
      ensureAssets(serverUrl.value, sync.assets || []).catch(() => {})
      offlineBadge.value = false
      return
    }

    if (sameVersion && cached && cached.config) {
      setConfig(cached.config)
    }
    stage.value = 'downloading'
    socket?.reportSyncStatus(sync.program_id, 0)
    const result = await ensureAssets(serverUrl.value, sync.assets || [], (p) => {
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
    offlineBadge.value = false
  } catch (err) {
    await tryOffline(err)
  }
}

async function tryOffline(err) {
  console.warn('[player] sync failed, try offline:', err)
  try {
    const cached = await window.playerAPI.stateRead()
    if (cached && cached.config) {
      setConfig(cached.config)
      offlineBadge.value = true
      stage.value = 'playing'
      return
    }
  } catch {}
  if (onlineBadge.value) {
    stage.value = 'offline'
  } else {
    stage.value = 'offline'
  }
  offlineRetryTimer = setTimeout(handleSync, 5000)
}

function setConfig(cfg) {
  configRef = cfg
  config.value = { device: cfg.device, pages: cfg.pages }
  stage.value = 'playing'
}

function handleCommand(msg) {
  if (!stageRef.value) return
  stageRef.value.executeAction(msg.action || '', msg.params || {})
  if (socket) socket.reportStatus(stageRef.value.getCurrentIndex(), '')
}

function onConnectionChange(v) {
  onlineBadge.value = v
}

function clearOfflineRetry() {
  if (offlineRetryTimer) { clearTimeout(offlineRetryTimer); offlineRetryTimer = null }
}

function handleKeydown(e) {
  if (e.key === 'Escape' && window.playerAPI && window.playerAPI.toggleFullscreen) {
    window.playerAPI.toggleFullscreen()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  let localIp = ''
  try {
    const cfg = await loadConfig()
    serverUrl.value = (cfg.serverUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '')
    deviceCode.value = cfg.deviceCode || 'DEV-001'
    if (window.playerAPI && window.playerAPI.getLocalIp) {
      localIp = await window.playerAPI.getLocalIp()
    }
  } catch {}
  const cached = await window.playerAPI.stateRead().catch(() => null)
  if (cached && cached.config) {
    setConfig(cached.config)
  }
  bootTimer = setTimeout(async () => {
    socket = createDeviceSocket({
      serverUrl: serverUrl.value,
      deviceCode: deviceCode.value,
      ipAddress: localIp,
      onUpdate: handleSync,
      onCommand: handleCommand,
      onConnectionChange,
    })
    await handleSync()
  }, 1500)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (bootTimer) clearTimeout(bootTimer)
  clearOfflineRetry()
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
</style>
