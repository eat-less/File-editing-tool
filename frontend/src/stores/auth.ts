import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, logout as logoutApi, checkAuth } from '@/api/auth'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<User | null>(JSON.parse(localStorage.getItem('user') || 'null'))
  const lastActivity = ref(Date.now())
  const isLocked = ref(false)
  let activityTimer: ReturnType<typeof setInterval> | null = null

  const isLoggedIn = computed(() => !!token.value)

  function startActivityMonitor() {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    const resetActivity = () => { lastActivity.value = Date.now() }
    events.forEach(e => document.addEventListener(e, resetActivity, { passive: true }))
    activityTimer = setInterval(() => {
      if (Date.now() - lastActivity.value > 10 * 60 * 1000) {
        isLocked.value = true
        logout()
      }
    }, 30000)
  }

  function stopActivityMonitor() {
    if (activityTimer) { clearInterval(activityTimer); activityTimer = null }
  }

  async function login(username: string, password: string) {
    const res = await loginApi(username, password)
    token.value = res.data.token
    user.value = res.data.user
    isLocked.value = false
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    startActivityMonitor()
    return res
  }

  async function logout() {
    try { await logoutApi() } catch { /* ignore */ }
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    stopActivityMonitor()
  }

  async function unlock(password: string) {
    if (!user.value) return false
    try {
      await loginApi(user.value.username, password)
      isLocked.value = false
      return true
    } catch {
      return false
    }
  }

  return { token, user, isLocked, isLoggedIn, login, logout, unlock, startActivityMonitor, stopActivityMonitor }
})
