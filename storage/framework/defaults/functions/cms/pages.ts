import type { Page } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent pages array using VueUse's useStorage
const pages = useStorage<Page[]>('pages', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all pages
async function fetchPages() {
  const { error, data } = useFetch<Page[]>(`${baseURL}/cms/pages`)

  if (error.value) {
    console.error('Error fetching pages:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    pages.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of pages but received:', typeof data.value)
    return []
  }
}

async function createPage(page: Partial<Page>) {
  const { error, data } = useFetch<Page>(`${baseURL}/cms/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...page,
      title: page.title,
      template: page.template,
      views: page.views || 0,
      conversions: page.conversions || 0,
    }),
  })

  if (error.value) {
    console.error('Error creating page:', error.value)
    return null
  }

  if (data.value) {
    pages.value.push(data.value)
    return data.value
  }
  return null
}

async function updatePage(page: Partial<Page>) {
  const { error, data } = useFetch<Page>(`${baseURL}/cms/pages/${page.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...page,
      title: page.title,
      template: page.template,
      views: page.views,
      conversions: page.conversions,
    }),
  })

  if (error.value) {
    console.error('Error updating page:', error.value)
    return null
  }

  if (data.value) {
    const index = pages.value.findIndex(p => p.id === page.id)
    if (index !== -1) {
      pages.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deletePage(id: number) {
  const { error } = useFetch(`${baseURL}/cms/pages/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting page:', error.value)
    return false
  }

  const index = pages.value.findIndex(p => p.id === id)
  if (index !== -1) {
    pages.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function usePages() {
  return {
    pages,
    fetchPages,
    createPage,
    updatePage,
    deletePage,
  }
}
