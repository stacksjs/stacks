/**
 * Releases Composable
 */
import { ref } from '@stacksjs/stx'

const baseUrl = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

export interface Release {
  version: string
  codename: string
  size: string
  path: string
  createdAt: string
}

export interface ReleaseStats {
  labels: string[]
  downloads: number[]
  releaseTimes: number[]
}

export function useReleases() {
  const releases = ref<Release[]>([])
  const stats = ref<ReleaseStats>({ labels: [], downloads: [], releaseTimes: [] })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    isLoading.value = true
    error.value = null
    try {
      const response = await fetch(`${baseUrl}/releases`, {
        headers: { 'Accept': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        releases.value = data.data || []
        stats.value = data.stats || stats.value
      }
    } catch (e) {
      error.value = 'Failed to load releases.'
      console.error('Failed to fetch releases:', e)
    } finally {
      isLoading.value = false
    }
  }

  return { releases, stats, isLoading, error, fetchAll }
}
