import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { getPrograms } from '@/api/project'
import type { Program } from '@/types'

export const useContentStore = defineStore('content', () => {
  const programs = ref<Program[]>([])
  const total = ref(0)
  const loading = ref(false)
  const filters = reactive<Record<string, any>>({
    exhibit_id: null,
    device_id: null,
    scene_id: null,
    status: null,
    keyword: null,
    page: 1,
    page_size: 20
  })

  async function fetchPrograms() {
    loading.value = true
    try {
      const params: any = {}
      Object.keys(filters).forEach(k => { if (filters[k]) params[k] = filters[k] })
      const res = await getPrograms(params)
      programs.value = res.data.items || []
      total.value = res.data.total || 0
    } finally {
      loading.value = false
    }
  }

  function setFilters(newFilters: Record<string, any>) {
    Object.assign(filters, newFilters)
    filters.page = 1
    fetchPrograms()
  }

  function setPage(page: number) {
    filters.page = page
    fetchPrograms()
  }

  return { programs, total, loading, filters, fetchPrograms, setFilters, setPage }
})
