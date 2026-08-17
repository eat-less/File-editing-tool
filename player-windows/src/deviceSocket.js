export function createDeviceSocket({ serverUrl, deviceCode, ipAddress, onUpdate, onCommand, onConnectionChange }) {
  const url = serverUrl.replace(/^http/i, 'ws') + `/api/v1/ws/device/${encodeURIComponent(deviceCode)}`
  let ws = null
  let heartbeat = null
  let reconnectTimer = null
  let stopped = false
  let online = false

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  function setOnline(v) {
    if (online === v) return
    online = v
    onConnectionChange?.(v)
  }

  function connect() {
    if (stopped) return
    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }
    ws.onopen = () => {
      setOnline(true)
      send({ type: 'device:register', device_code: deviceCode, ip_address: ipAddress || '', version: '1.0.0' })
      heartbeat = setInterval(() => send({ type: 'device:heartbeat', device_code: deviceCode }), 30000)
    }
    ws.onmessage = (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.type === 'server:update') onUpdate?.(msg)
      else if (msg.type === 'server:command') onCommand?.(msg)
    }
    ws.onclose = () => {
      setOnline(false)
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
      scheduleReconnect()
    }
    ws.onerror = () => {
      try { ws.close() } catch {}
    }
  }

  function scheduleReconnect() {
    if (stopped) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 3000)
  }

  function sendDeviceAction(actionMsg) {
    send(actionMsg)
  }

  function reportStatus(currentPage, currentScene) {
    send({ type: 'deviceStatus', currentPage: currentPage ?? '', currentScene: currentScene ?? '' })
  }

  function reportSyncStatus(programId, progress) {
    send({ type: 'device:sync_status', program_id: programId, status: 'syncing', progress: progress ?? 0 })
  }

  function reportSyncDone(programId, version) {
    send({ type: 'device:sync_done', program_id: programId, version, status: 'synced' })
  }

  function stop() {
    stopped = true
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    if (ws) { try { ws.close() } catch {} ws = null }
  }

  connect()

  return { sendDeviceAction, reportStatus, reportSyncStatus, reportSyncDone, stop }
}
