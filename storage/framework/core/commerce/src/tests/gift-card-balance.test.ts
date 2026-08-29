import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from './setup'
import { deactivate } from '../gift-cards/destroy'
import { fetchById } from '../gift-cards/fetch'
import { store } from '../gift-cards/store'
import { updateBalance } from '../gift-cards/update'

beforeEach(async () => {
  await refreshDatabase()
})

let seq = 0

/**
 * `fetchById` hands back the raw row, so the balance arrives snake_cased even
 * though the declared type is camelCase. Read both rather than pinning the test
 * to the spelling that happens to win today.
 */
function balanceOf(card: unknown): number {
  const row = (card ?? {}) as Record<string, unknown>
  return Number(row.current_balance ?? row.currentBalance)
}

function lastUsedOf(card: unknown): unknown {
  const row = (card ?? {}) as Record<string, unknown>
  return row.last_used_date ?? row.lastUsedDate ?? null
}

/** A card in whatever starting state a case needs. */
async function makeCard(overrides: Record<string, unknown> = {}) {
  seq += 1
  const card = await store({
    code: `GC-${Date.now()}-${seq}`,
    initial_balance: 100,
    current_balance: 100,
    currency: 'USD',
    status: 'ACTIVE',
    is_active: true,
    ...overrides,
  } as never)

  expect(card).toBeDefined()
  return card!
}

describe('Gift card balance', () => {
  describe('redemption', () => {
    it('deducts from the balance and stamps last_used_date', async () => {
      const card = await makeCard()

      const after = await updateBalance(card.id, -40)

      expect(balanceOf(after)).toBe(60)
      expect(after?.status).toBe('ACTIVE')
      expect(lastUsedOf(after)).toBeTruthy()
    })

    it('marks the card USED once the balance reaches zero', async () => {
      const card = await makeCard()

      const after = await updateBalance(card.id, -100)

      expect(balanceOf(after)).toBe(0)
      expect(after?.status).toBe('USED')
    })

    it('refuses to overspend', async () => {
      const card = await makeCard()

      await expect(updateBalance(card.id, -150)).rejects.toThrow('Insufficient gift card balance')

      const unchanged = await fetchById(card.id)
      expect(balanceOf(unchanged)).toBe(100)
    })

    it('refuses a card that is not active', async () => {
      const card = await makeCard({ is_active: false })

      await expect(updateBalance(card.id, -10)).rejects.toThrow('Gift card is not active')
    })

    it('refuses a card whose expiry date has passed', async () => {
      // Regression: `updateBalance` enforced status and balance but never the
      // expiry date, so an expired card stayed spendable indefinitely - nothing
      // in the module flips an expired card out of ACTIVE on its own.
      const card = await makeCard({ expiry_date: formatDate(new Date('2020-01-01')) })

      await expect(updateBalance(card.id, -10)).rejects.toThrow('Gift card has expired')

      const unchanged = await fetchById(card.id)
      expect(balanceOf(unchanged)).toBe(100)
    })

    it('allows a card whose expiry date is still in the future', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      const card = await makeCard({ expiry_date: formatDate(future) })

      const after = await updateBalance(card.id, -25)

      expect(balanceOf(after)).toBe(75)
    })
  })

  describe('reload', () => {
    it('adds to the balance of an active card', async () => {
      const card = await makeCard()

      const after = await updateBalance(card.id, 50)

      expect(balanceOf(after)).toBe(150)
      expect(after?.status).toBe('ACTIVE')
    })

    it('revives a reloadable card that was spent down to USED', async () => {
      // Regression: the WHERE clause demanded `status = 'ACTIVE'` in both
      // directions, so a card spent to zero flipped to USED and could never be
      // topped up again - which made `is_reloadable` a field nothing honoured.
      const card = await makeCard({ is_reloadable: true })

      const spent = await updateBalance(card.id, -100)
      expect(spent?.status).toBe('USED')

      const reloaded = await updateBalance(card.id, 25)

      expect(balanceOf(reloaded)).toBe(25)
      expect(reloaded?.status).toBe('ACTIVE')
    })

    it('refuses to reload a spent card that is not reloadable', async () => {
      const card = await makeCard({ is_reloadable: false })

      await updateBalance(card.id, -100)

      await expect(updateBalance(card.id, 25)).rejects.toThrow('Gift card is not reloadable')
    })

    it('does not stamp last_used_date on a reload', async () => {
      const card = await makeCard()

      const after = await updateBalance(card.id, 10)

      expect(lastUsedOf(after)).toBeFalsy()
    })
  })

  describe('guards', () => {
    it('rejects a non-finite adjustment', async () => {
      const card = await makeCard()

      await expect(updateBalance(card.id, Number.NaN)).rejects.toThrow('must be a finite number')
    })

    it('reports a missing card distinctly from a failed precondition', async () => {
      await expect(updateBalance(99999999, -10)).rejects.toThrow('not found')
    })
  })

  describe('deactivate', () => {
    it('flips the card inactive and reports that a row changed', async () => {
      // Regression: this returned `!!result`, and a driver result object is
      // truthy whether it updated one row or none.
      const card = await makeCard()

      expect(await deactivate(card.id)).toBe(true)

      const after = await fetchById(card.id)
      expect(after?.status).toBe('DEACTIVATED')
    })

    it('throws for a card that does not exist', async () => {
      await expect(deactivate(99999999)).rejects.toThrow('not found')
    })
  })
})
