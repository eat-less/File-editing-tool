import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { getLogs } from '@/api/asset'
import type { SystemLog } from '@/types'

export const useLogStore = defineStore('log', () => {
  const logs = ref<SystemLog[]>([])
  const total = ref(0)
  const wsConnected = ref(false)
  const filters = reactive<Record<string, any>>({
    log_type: null, module: null, keyword: null,
    start_time: null, end_time: null, page: 1, page_size: 20
  })

  async function fetchLogs() {
    const params: any = {}
    Object.keys(filters).forEach(k => { if (filters[k]) params[k] = filters[k] })
    const res = await getLogs(params)
    logs.value = res.data.items || []
    total.value = res.data.total || 0
  }

  function setPage(page: number) {
    filters.page = page
    fetchLogs()
  }

  return { logs, total, wsConnected, filters, fetchLogs, setPage }
})
