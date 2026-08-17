const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('playerAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  cacheExists: (hash) => ipcRenderer.invoke('cache:exists', hash),
  cacheWrite: (payload) => ipcRenderer.invoke('cache:write', payload),
  cacheList: () => ipcRenderer.invoke('cache:list'),
  cacheClear: () => ipcRenderer.invoke('cache:clear'),
  stateRead: () => ipcRenderer.invoke('state:read'),
  stateWrite: (payload) => ipcRenderer.invoke('state:write', payload),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
})
