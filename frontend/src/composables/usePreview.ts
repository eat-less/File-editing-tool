import { ref } from 'vue'

export function usePreview() {
  const isPreviewing = ref(false)
  const currentPreviewPage = ref(0)
  const isFullscreen = ref(false)
  const autoPlayTimer = ref<ReturnType<typeof setInterval> | null>(null)

  function start(pages: any[]) {
    currentPreviewPage.value = 0
    isPreviewing.value = true
    startAutoPlay(pages)
  }

  function stop() {
    isPreviewing.value = false
    isFullscreen.value = false
    stopAutoPlay()
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }

  function next(pages: any[]) {
    if (currentPreviewPage.value < pages.length - 1) {
      currentPreviewPage.value++
    } else {
      currentPreviewPage.value = 0
    }
  }

  function prev(pages: any[]) {
    if (currentPreviewPage.value > 0) {
      currentPreviewPage.value--
    } else {
      currentPreviewPage.value = pages.length - 1
    }
  }

  function goToPage(index: number) {
    currentPreviewPage.value = index
  }

  async function toggleFullscreen() {
    if (isFullscreen.value) {
      if (document.fullscreenElement) await document.exitFullscreen()
      isFullscreen.value = false
    } else {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    }
  }

  function startAutoPlay(pages: any[]) {
    stopAutoPlay()
    const page = pages[currentPreviewPage.value]
    if (page && page.duration) {
      autoPlayTimer.value = setInterval(() => {
        next(pages)
        const newPage = pages[currentPreviewPage.value]
        if (newPage && newPage.duration !== page.duration) {
          startAutoPlay(pages)
        }
      }, page.duration)
    }
  }

  function stopAutoPlay() {
    if (autoPlayTimer.value) {
      clearInterval(autoPlayTimer.value)
      autoPlayTimer.value = null
    }
  }

  return { isPreviewing, currentPreviewPage, isFullscreen, start, stop, next, prev, goToPage, toggleFullscreen }
}
