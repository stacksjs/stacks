import type { Pages } from '../../types/defaults'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent pages array using VueUse's useStorage
const pages = useStorage<Pages[]>('pages', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all pages
async function fetchPages() {
  const { error, data } = await useFetch(`${baseURL}/cms/pages`).get().json()

  const pagesJson = data.value as Pages[]
  if (error.value) {
    console.error('Error fetching pages:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    pages.value = pagesJson
    return data.value
  }
  else {
    console.error('Expected array of pages but received:', typeof data.value)
    return []
  }
}

async function createPage(page: Partial<Pages>) {
  const { error, data } = await useFetch(`${baseURL}/cms/pages`)
    .post(JSON.stringify({
      ...page,
      title: page.title,
      template: page.template,
      views: page.views || 0,
      conversions: page.conversions || 0,
    }))
    .json()

  if (error.value) {
    console.error('Error creating page:', error.value)
    return null
  }

  const newPage = data.value as Pages
  if (newPage) {
    pages.value.push(newPage)
    return newPage
  }
  return null
}

async function updatePage(id: number, page: Partial<Pages>) {
  const { error, data } = await useFetch(`${baseURL}/cms/pages/${id}`)
    .patch(JSON.stringify({
      ...page,
      title: page.title,
      template: page.template,
      views: page.views,
      conversions: page.conversions,
    }))
    .json()

  if (error.value) {
    console.error('Error updating page:', error.value)
    return null
  }

  const updatedPage = data.value as Pages
  if (updatedPage) {
    const index = pages.value.findIndex(p => p.id === id)
    if (index !== -1) {
      pages.value[index] = updatedPage
    }
    return updatedPage
  }
  return null
}

async function deletePage(id: number) {
  const { error } = await useFetch(`${baseURL}/cms/pages/${id}`)
    .delete()
    .json()

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
