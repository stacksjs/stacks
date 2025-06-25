import type { ProductVariants } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent variants array using VueUse's useStorage
const variants = useStorage<ProductVariants[]>('variants', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all variants
async function fetchVariants() {
  try {
    const response = await fetch(`${baseURL}/commerce/products/variants`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as ProductVariants[]

    if (Array.isArray(data)) {
      variants.value = data
      return data
    }
    else {
      console.error('Expected array of variants but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching variants:', error)
    return []
  }
}

async function createVariant(variant: ProductVariants) {
  try {
    const response = await fetch(`${baseURL}/commerce/products/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(variant),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ProductVariants
    if (data) {
      variants.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating variant:', error)
    return null
  }
}

async function updateVariant(variant: ProductVariants) {
  try {
    const response = await fetch(`${baseURL}/commerce/products/variants/${variant.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(variant),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ProductVariants
    if (data) {
      const index = variants.value.findIndex(v => v.id === variant.id)
      if (index !== -1) {
        variants.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating variant:', error)
    return null
  }
}

async function deleteVariant(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/products/variants/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = variants.value.findIndex(v => v.id === id)
    if (index !== -1) {
      variants.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting variant:', error)
    return false
  }
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
