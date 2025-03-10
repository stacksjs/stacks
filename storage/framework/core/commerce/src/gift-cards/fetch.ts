import type { GiftCardJsonResponse } from '../../../../orm/src/models/GiftCard'
import type { FetchGiftCardsOptions, GiftCardResponse, GiftCardStats } from '../../types'
import { db, sql } from '@stacksjs/database'

/**
 * Fetch all gift cards from the database
 */
export async function fetchAll(): Promise<GiftCardJsonResponse[]> {
  const giftCards = await db
    .selectFrom('gift_cards')
    .selectAll()
    .execute()

  return giftCards
}

/**
 * Fetch gift cards with pagination, sorting, and filtering options
 */
export async function fetchPaginated(options: FetchGiftCardsOptions = {}): Promise<GiftCardResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  let query = db.selectFrom('gift_cards')
  let countQuery = db.selectFrom('gift_cards')

  if (options.max_balance !== undefined) {
    query = query.where('current_balance', '<=', options.max_balance)
    countQuery = countQuery.where('current_balance', '<=', options.max_balance)
  }

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const giftCards = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: giftCards,
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
}

/**
 * Fetch a gift card by ID
 */
export async function fetchById(id: number): Promise<GiftCardJsonResponse | undefined> {
  return await db
    .selectFrom('gift_cards')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch a gift card by code
 */
export async function fetchByCode(code: string): Promise<GiftCardJsonResponse | undefined> {
  return await db
    .selectFrom('gift_cards')
    .where('code', '=', code)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch active gift cards (is_active = true and not expired)
 */
export async function fetchActive(options: FetchGiftCardsOptions = {}): Promise<GiftCardResponse> {
  return fetchPaginated({
    ...options,
    is_active: true,
    status: 'ACTIVE',
  })
}

/**
 * Get gift card statistics
 */
export async function fetchStats(): Promise<GiftCardStats> {
  // Total gift cards
  const totalGiftCards = await db
    .selectFrom('gift_cards')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Active gift cards
  const currentDate = new Date().toISOString().split('T')[0]
  const activeGiftCards = await db
    .selectFrom('gift_cards')
    .where('is_active', '=', true)
    .where('status', '=', 'ACTIVE')
    .where(eb => eb.or([
      eb('expiry_date', '>=', currentDate),
      eb('expiry_date', 'is', null),
    ]))
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Gift cards by status
  const giftCardsByStatus = await db
    .selectFrom('gift_cards')
    .select(['status', eb => eb.fn.count('id').as('count')])
    .groupBy('status')
    .execute()

  // Calculate balance distribution counts - separate queries for better reliability
  const lowBalanceCount = await db
    .selectFrom('gift_cards')
    .where((eb) => {
      return sql`${eb.ref('current_balance')} / ${eb.ref('initial_balance')} < 0.25`
    })
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const mediumBalanceCount = await db
    .selectFrom('gift_cards')
    .where((eb) => {
      // Using a raw expression inside the expression builder
      return sql`${eb.ref('current_balance')} / ${eb.ref('initial_balance')} >= 0.25 AND ${eb.ref('current_balance')} / ${eb.ref('initial_balance')} <= 0.75`
    })
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const highBalanceCount = await db
    .selectFrom('gift_cards')
    .where((eb) => {
      // Using a raw expression inside the expression builder
      return sql`${eb.ref('current_balance')} / ${eb.ref('initial_balance')} > 0.75`
    })
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Expiring soon gift cards (next 30 days)
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const expiringGiftCards = await db
    .selectFrom('gift_cards')
    .where('is_active', '=', true)
    .where('status', '=', 'ACTIVE')
    .where('expiry_date', '<=', thirtyDaysFromNow.toISOString().split('T')[0])
    .where('expiry_date', '>=', currentDate)
    .selectAll()
    .limit(5)
    .execute()

  // Recently used gift cards
  const recentlyUsedGiftCards = await db
    .selectFrom('gift_cards')
    .where('last_used_date', 'is not', null)
    .selectAll()
    .limit(5)
    .execute()

  return {
    total: Number(totalGiftCards?.count || 0),
    active: Number(activeGiftCards?.count || 0),
    by_status: giftCardsByStatus.map(item => ({
      status: item.status,
      count: Number(item.count),
    })),
    by_balance: {
      low: Number(lowBalanceCount?.count || 0),
      medium: Number(mediumBalanceCount?.count || 0),
      high: Number(highBalanceCount?.count || 0),
    },
    expiring_soon: expiringGiftCards,
    recently_used: recentlyUsedGiftCards,
  }
}

/**
 * Check gift card balance by code
 */
export async function checkBalance(code: string): Promise<{ valid: boolean, balance?: number, currency?: string, message?: string }> {
  const giftCard = await fetchByCode(code)

  if (!giftCard) {
    return { valid: false, message: 'Gift card not found' }
  }

  if (!giftCard.is_active || giftCard.status !== 'ACTIVE') {
    return {
      valid: false,
      balance: giftCard.current_balance,
      currency: giftCard.currency,
      message: `Gift card is ${giftCard.status.toLowerCase()}`,
    }
  }

  // Check if expired
  if (giftCard.expiry_date) {
    const expiryDate = new Date(giftCard.expiry_date)
    const currentDate = new Date()

    if (expiryDate < currentDate) {
      return {
        valid: false,
        balance: giftCard.current_balance,
        currency: giftCard.currency,
        message: 'Gift card has expired',
      }
    }
  }

  return {
    valid: true,
    balance: giftCard.current_balance,
    currency: giftCard.currency,
  }
}
