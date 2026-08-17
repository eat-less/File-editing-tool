import request from './request'

export const uploadAssets = (formData: FormData) =>
  request.post('/assets/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const uploadBatch = (formData: FormData) =>
  request.post('/assets/upload/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const uploadSequence = (formData: FormData) =>
  request.post('/assets/upload/sequence', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const getAssets = (params?: any) => request.get('/assets', { params })

export const getSceneAssets = (sceneId: string, params?: any) =>
  request.get('/assets', { params: { ...params, scene_id: sceneId } })

export const deleteAsset = (hashKey: string) => request.delete(`/assets/${hashKey}`)

export const cleanupUnreferenced = () => request.post('/assets/cleanup-unreferenced')

export const getLogs = (params?: any) => request.get('/logs', { params })
