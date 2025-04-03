import { useFetch, useStorage } from '@vueuse/core'
import { Variants } from '../../../types'


// Create a persistent variants array using VueUse's useStorage
const variants = useStorage<Variants[]>('variants', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all variants
async function fetchVariants() {
  const { error, data } = useFetch<Variants[]>(`${baseURL}/commerce/products/variants`)

  if (error.value) {
    console.error('Error fetching variants:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    variants.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of variants but received:', typeof data.value)
    return []
  }
}

async function createVariant(variant: Variants) {
  const { error, data } = useFetch<Variants>(`${baseURL}/commerce/products/variants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(variant),
  })

  if (error.value) {
    console.error('Error creating variant:', error.value)
    return null
  }

  if (data.value) {
    variants.value.push(data.value)
    return data.value
  }
  return null
}

async function updateVariant(variant: Variants) {
  const { error, data } = useFetch<Variants>(`${baseURL}/commerce/products/variants/${variant.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(variant),
  })

  if (error.value) {
    console.error('Error updating variant:', error.value)
    return null
  }

  if (data.value) {
    const index = variants.value.findIndex(v => v.id === variant.id)
    if (index !== -1) {
      variants.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteVariant(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/products/variants/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting variant:', error.value)
    return false
  }

  const index = variants.value.findIndex(v => v.id === id)
  if (index !== -1) {
    variants.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useVariants() {
  return {
    variants,
    fetchVariants,
    createVariant,
    updateVariant,
    deleteVariant,
  }
}
