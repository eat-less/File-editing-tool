import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as exhibitApi from '@/api/exhibit'
import * as projectApi from '@/api/project'
import type { Exhibit, Scene, Device } from '@/types'

export const useProjectStore = defineStore('project', () => {
  const exhibits = ref<Exhibit[]>([])
  const scenes = ref<Scene[]>([])
  const devices = ref<Device[]>([])

  async function fetchExhibits() {
    const res = await exhibitApi.getExhibits()
    exhibits.value = res.data
  }

  async function createExhibitItem(data: any) {
    await exhibitApi.createExhibit(data)
    await fetchExhibits()
  }

  async function updateExhibitItem(id: string, data: any) {
    await exhibitApi.updateExhibit(id, data)
    await fetchExhibits()
  }

  async function deleteExhibitItem(id: string) {
    await exhibitApi.deleteExhibit(id)
    await fetchExhibits()
  }

  async function fetchScenes(exhibitId: string) {
    const res = await exhibitApi.getScenes(exhibitId)
    scenes.value = res.data
  }

  async function createSceneItem(exhibitId: string, data: any) {
    await exhibitApi.createScene(exhibitId, data)
    await fetchScenes(exhibitId)
  }

  async function updateSceneItem(id: string, data: any) {
    await exhibitApi.updateScene(id, data)
  }

  async function deleteSceneItem(id: string) {
    await exhibitApi.deleteScene(id)
  }

  async function fetchExhibitDevices(exhibitId: string) {
    const res = await exhibitApi.getExhibitDevices(exhibitId)
    devices.value = res.data
  }

  async function createExhibitDeviceItem(exhibitId: string, data: any) {
    await exhibitApi.createExhibitDevice(exhibitId, data)
    await fetchExhibitDevices(exhibitId)
  }

  async function updateDeviceItem(id: string, data: any) {
    await exhibitApi.updateDevice(id, data)
  }

  async function deleteDeviceItem(id: string) {
    await exhibitApi.deleteDevice(id)
  }

  async function fetchDeviceStatus(id: string) {
    return await exhibitApi.getDeviceStatus(id)
  }

  return {
    exhibits, scenes, devices,
    fetchExhibits, createExhibitItem, updateExhibitItem, deleteExhibitItem,
    fetchScenes, createSceneItem, updateSceneItem, deleteSceneItem,
    fetchExhibitDevices, createExhibitDeviceItem, updateDeviceItem, deleteDeviceItem,
    fetchDeviceStatus
  }
})
