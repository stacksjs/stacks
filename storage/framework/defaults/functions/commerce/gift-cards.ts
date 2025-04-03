import { useFetch, useStorage } from '@vueuse/core'
import { GiftCard } from '../../../types'

// Create a persistent gift cards array using VueUse's useStorage
const giftCards = useStorage<GiftCard[]>('giftCards', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all gift cards
async function fetchGiftCards(): Promise<GiftCard[]> {
  const { error, data } = useFetch<GiftCard[]>(`${baseURL}/commerce/gift-cards`)

  if (error.value) {
    console.error('Error fetching gift cards:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    giftCards.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of gift cards but received:', typeof data.value)
    return []
  }
}

async function createGiftCard(giftCard: GiftCard): Promise<GiftCard | null> {
  const { error, data } = useFetch<GiftCard>(`${baseURL}/commerce/gift-cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(giftCard),
  })

  if (error.value) {
    console.error('Error creating gift card:', error.value)
    return null
  }

  if (data.value) {
    giftCards.value.push(data.value)
    return data.value
  }
  return null
}

async function updateGiftCard(giftCard: GiftCard): Promise<GiftCard | null> {
  const { error, data } = useFetch<GiftCard>(`${baseURL}/commerce/gift-cards/${giftCard.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(giftCard),
  })

  if (error.value) {
    console.error('Error updating gift card:', error.value)
    return null
  }

  if (data.value) {
    const index = giftCards.value.findIndex(g => g.id === giftCard.id)
    if (index !== -1) {
      giftCards.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteGiftCard(id: number): Promise<boolean> {
  const { error } = useFetch(`${baseURL}/commerce/gift-cards/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting gift card:', error.value)
    return false
  }

  const index = giftCards.value.findIndex(g => g.id === id)
  if (index !== -1) {
    giftCards.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useGiftCards() {
  return {
    giftCards,
    fetchGiftCards,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
  }
}
