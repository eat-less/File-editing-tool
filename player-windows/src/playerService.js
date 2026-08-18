export function wsUrl(serverUrl, deviceCode) {
  return serverUrl.replace(/^http/i, 'ws') + `/api/v1/ws/device/${encodeURIComponent(deviceCode)}`
}

async function fetchWithTimeout(url, ms = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchSync(serverUrl, deviceCode) {
  const url = `${serverUrl}/api/v1/player/${encodeURIComponent(deviceCode)}/sync`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`sync failed: ${res.status}`)
  const json = await res.json()
  return json.data
}

export async function fetchAssetBuffer(serverUrl, hash) {
  const res = await fetchWithTimeout(`${serverUrl}/api/v1/assets/${encodeURIComponent(hash)}/file`)
  if (!res.ok) throw new Error(`asset failed: ${res.status} ${hash}`)
  return await res.arrayBuffer()
}

export async function downloadAssetToCache(serverUrl, asset) {
  const exists = await window.playerAPI.cacheExists(asset.hash_key)
  if (exists) return { downloaded: false }
  const buf = await fetchAssetBuffer(serverUrl, asset.hash_key)
  const result = await window.playerAPI.cacheWrite({
    hash: asset.hash_key,
    data: buf,
    mime: asset.mime_type || 'application/octet-stream',
  })
  if (!result.ok) throw new Error(result.error || 'cache write failed')
  return { downloaded: true }
}

export async function assetsCached(assets) {
  for (const asset of assets) {
    const exists = await window.playerAPI.cacheExists(asset.hash_key)
    if (!exists) return false
  }
  return true
}

export async function ensureAssets(serverUrl, assets, onProgress) {
  const total = assets.length
  let done = 0
  let downloadedBytes = 0
  for (const asset of assets) {
    const r = await downloadAssetToCache(serverUrl, asset)
    if (r.downloaded) downloadedBytes += asset.file_size || 0
    done++
    if (onProgress) onProgress({ done, total, percent: total ? Math.round((done / total) * 100) : 100, downloadedBytes })
  }
  return { total, downloadedBytes }
}
