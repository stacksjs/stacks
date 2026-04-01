/**
 * Global Search Composable
 *
 * Provides search functionality across all models for the dashboard.
 */

import { ref } from '@stacksjs/stx'

const baseUrl = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

export interface SearchResultItem {
  id: string | number
  title: string
  subtitle?: string
  href: string
  icon: string
}

export interface SearchResults {
  [modelType: string]: SearchResultItem[]
}

const modelIcons: Record<string, string> = {
  users: 'i-hugeicons-user-group',
  products: 'i-hugeicons-shopping-bag-02',
  customers: 'i-hugeicons-user-02',
  orders: 'i-hugeicons-shopping-cart-01',
  posts: 'i-hugeicons-note-edit',
  pages: 'i-hugeicons-file-02',
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

export function useGlobalSearch() {
  const query = ref('')
  const results = ref<SearchResults>({})
  const isSearching = ref(false)
  const isOpen = ref(false)
  const selectedIndex = ref(0)

  async function search(q: string) {
    if (!q.trim()) {
      results.value = {}
      return
    }

    isSearching.value = true

    try {
      const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Accept': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        results.value = data.results || {}
      }
    }
    catch (e) {
      console.error('Search failed:', e)
      results.value = {}
    }
    finally {
      isSearching.value = false
    }
  }

  function debouncedSearch(q: string) {
    query.value = q
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => search(q), 300)
  }

  function open() {
    isOpen.value = true
    selectedIndex.value = 0
  }

  function close() {
    isOpen.value = false
    query.value = ''
    results.value = {}
  }

  function flatResults(): SearchResultItem[] {
    return Object.values(results.value).flat()
  }

  function moveUp() {
    const items = flatResults()
    if (items.length === 0) return
    selectedIndex.value = selectedIndex.value <= 0 ? items.length - 1 : selectedIndex.value - 1
  }

  function moveDown() {
    const items = flatResults()
    if (items.length === 0) return
    selectedIndex.value = selectedIndex.value >= items.length - 1 ? 0 : selectedIndex.value + 1
  }

  function selectCurrent(): string | null {
    const items = flatResults()
    const selected = items[selectedIndex.value]
    if (selected) {
      close()
      return selected.href
    }
    return null
  }

  return {
    query,
    results,
    isSearching,
    isOpen,
    selectedIndex,
    modelIcons,
    search: debouncedSearch,
    open,
    close,
    moveUp,
    moveDown,
    selectCurrent,
    flatResults,
  }
}
