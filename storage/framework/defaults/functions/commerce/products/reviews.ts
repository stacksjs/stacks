import type { Reviews } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent reviews array using VueUse's useStorage
const reviews = useStorage<Reviews[]>('reviews', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all reviews
async function fetchReviews(): Promise<Reviews[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/reviews`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as Reviews[]

    if (Array.isArray(data)) {
      reviews.value = data
      return data
    }
    else {
      console.error('Expected array of reviews but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching reviews:', error)
    return []
  }
}

async function createReview(review: Reviews): Promise<Reviews | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(review),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Reviews
    if (data) {
      reviews.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating review:', error)
    return null
  }
}

async function updateReview(review: Reviews): Promise<Reviews | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/reviews/${review.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(review),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Reviews
    if (data) {
      const index = reviews.value.findIndex(r => r.id === review.id)
      if (index !== -1) {
        reviews.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating review:', error)
    return null
  }
}

async function deleteReview(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/reviews/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = reviews.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reviews.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting review:', error)
    return false
  }
}

// Export the composable
export function useReviews() {
  return {
    reviews,
    fetchReviews,
    createReview,
    updateReview,
    deleteReview,
  }
}
