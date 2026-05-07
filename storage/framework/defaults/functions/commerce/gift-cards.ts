import type { GiftCards } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent gift cards array using VueUse's useStorage
const giftCards = useStorage<GiftCards[]>('giftCards', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

async function fetchGiftCards(): Promise<GiftCards[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as GiftCards[]

    if (Array.isArray(data)) {
      giftCards.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load gift cards', { detail: `Expected array but received ${typeof data}` })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load gift cards', { detail: String(error) })
    return giftCards.value
  }
}

async function createGiftCard(giftCard: GiftCards): Promise<GiftCards | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(giftCard),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as GiftCards
    if (data) {
      giftCards.value.push(data)
      pushToast('success', 'Gift card created')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to create gift card', { detail: String(error) })
    return null
  }
}

async function updateGiftCard(giftCard: GiftCards): Promise<GiftCards | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards/${giftCard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(giftCard),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as GiftCards
    if (data) {
      const index = giftCards.value.findIndex(g => g.id === giftCard.id)
      if (index !== -1) {
        giftCards.value[index] = data
      }
      pushToast('success', 'Gift card updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update gift card', { detail: String(error) })
    return null
  }
}

async function deleteGiftCard(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = giftCards.value.findIndex(g => g.id === id)
    if (index !== -1) {
      giftCards.value.splice(index, 1)
    }
    pushToast('success', 'Gift card deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete gift card', { detail: String(error) })
    return false
  }
}

export function useGiftCards() {
  return {
    giftCards,
    fetchGiftCards,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
  }
}
