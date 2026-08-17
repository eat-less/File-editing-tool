export async function loadConfig() {
  if (window.playerAPI && window.playerAPI.getConfig) {
    return await window.playerAPI.getConfig()
  }
  return { serverUrl: 'http://127.0.0.1:8000', deviceCode: 'DEV-001' }
}
