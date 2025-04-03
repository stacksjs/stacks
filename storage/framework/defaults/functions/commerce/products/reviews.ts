import { useFetch, useStorage } from '@vueuse/core'
import { Reviews } from '../../../types'


// Create a persistent reviews array using VueUse's useStorage
const reviews = useStorage<Reviews[]>('reviews', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all reviews
async function fetchReviews(): Promise<Reviews[]> {
  const { error, data } = useFetch<Reviews[]>(`${baseURL}/commerce/products/reviews`)

  if (error.value) {
    console.error('Error fetching reviews:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    reviews.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of reviews but received:', typeof data.value)
    return []
  }
}

async function createReview(review: Reviews): Promise<Reviews | null> {
  const { error, data } = useFetch<Reviews>(`${baseURL}/commerce/products/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(review),
  })

  if (error.value) {
    console.error('Error creating review:', error.value)
    return null
  }

  if (data.value) {
    reviews.value.push(data.value)
    return data.value
  }
  return null
}

async function updateReview(review: Reviews): Promise<Reviews | null> {
  const { error, data } = useFetch<Reviews>(`${baseURL}/commerce/products/reviews/${review.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(review),
  })

  if (error.value) {
    console.error('Error updating review:', error.value)
    return null
  }

  if (data.value) {
    const index = reviews.value.findIndex(r => r.id === review.id)
    if (index !== -1) {
      reviews.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteReview(id: number): Promise<boolean> {
  const { error } = useFetch(`${baseURL}/commerce/products/reviews/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting review:', error.value)
    return false
  }

  const index = reviews.value.findIndex(r => r.id === id)
  if (index !== -1) {
    reviews.value.splice(index, 1)
  }

  return true
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
