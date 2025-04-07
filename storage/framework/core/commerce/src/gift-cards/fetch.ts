import type { GiftCardJsonResponse } from '@stacksjs/orm'
import type { GiftCardStats } from '../types'
import { db, sql } from '@stacksjs/database'
import { formatDate, toTimestamp } from '@stacksjs/orm'

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
export async function fetchActive(): Promise<GiftCardJsonResponse> {
  const giftCards = await db
    .selectFrom('gift_cards')
    .where('is_active', '=', true)
    .selectAll()
    .execute()

  return giftCards
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
  const currentDate = toTimestamp(new Date())

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
    .where('expiry_date', '<=', toTimestamp(thirtyDaysFromNow))
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

/**
 * Compare active gift cards between different time periods
 * @param daysRange Number of days to look back (7, 30, 60, etc.)
 */
export async function compareActiveGiftCards(daysRange: number = 30): Promise<{
  current_period: number
  previous_period: number
  difference: number
  percentage_change: number
  days_range: number
}> {
  const today = new Date()

  // Current period (last N days)
  const currentPeriodStart = new Date(today)
  currentPeriodStart.setDate(today.getDate() - daysRange)

  // Previous period (N days before the current period)
  const previousPeriodEnd = new Date(currentPeriodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)

  const previousPeriodStart = new Date(previousPeriodEnd)
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysRange)

  // Get active gift cards for current period
  const currentPeriodActive = await db
    .selectFrom('gift_cards')
    .select(db.fn.count('id').as('count'))
    .where('is_active', '=', true)
    .where('status', '=', 'ACTIVE')
    .where(eb => eb.or([
      eb('expiry_date', '>=', toTimestamp(today)),
      eb('expiry_date', 'is', null),
    ]))
    .where('created_at', '>=', formatDate(currentPeriodStart))
    .where('created_at', '<=', formatDate(today))
    .executeTakeFirst()

  // Get active gift cards for previous period
  const previousPeriodActive = await db
    .selectFrom('gift_cards')
    .select(db.fn.count('id').as('count'))
    .where('is_active', '=', true)
    .where('status', '=', 'ACTIVE')
    .where(eb => eb.or([
      eb('expiry_date', '>=', toTimestamp(previousPeriodStart)),
      eb('expiry_date', 'is', null),
    ]))
    .where('created_at', '>=', formatDate(previousPeriodStart))
    .where('created_at', '<=', formatDate(previousPeriodEnd))
    .executeTakeFirst()

  const currentCount = Number(currentPeriodActive?.count || 0)
  const previousCount = Number(previousPeriodActive?.count || 0)
  const difference = currentCount - previousCount

  // Calculate percentage change, handling division by zero
  const percentageChange = previousCount !== 0
    ? (difference / previousCount) * 100
    : (currentCount > 0 ? 100 : 0)

  return {
    current_period: currentCount,
    previous_period: previousCount,
    difference,
    percentage_change: percentageChange,
    days_range: daysRange,
  }
}

/**
 * Calculate gift card balances and initial values for different time periods
 * with clear increase/decrease indicators
 * @param daysRange Number of days to look back (7, 30, 60, etc.)
 */
export async function calculateGiftCardValues(daysRange: number = 30): Promise<{
  current_period: {
    total_initial_value: number
    total_remaining_balance: number
    utilization_rate: number
    card_count: number
    average_initial_value: number
    average_remaining_balance: number
  }
  previous_period: {
    total_initial_value: number
    total_remaining_balance: number
    utilization_rate: number
    card_count: number
  }
  comparison: {
    initial_value: {
      difference: number
      percentage: number
      is_increase: boolean
    }
    balance: {
      difference: number
      percentage: number
      is_increase: boolean
    }
    card_count: {
      difference: number
      percentage: number
      is_increase: boolean
    }
  }
  days_range: number
}> {
  const today = new Date()

  // Current period (last N days)
  const currentPeriodStart = new Date(today)
  currentPeriodStart.setDate(today.getDate() - daysRange)

  // Previous period (N days before the current period)
  const previousPeriodEnd = new Date(currentPeriodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)

  const previousPeriodStart = new Date(previousPeriodEnd)
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysRange)

  // Get values for current period
  const currentPeriodValues = await db
    .selectFrom('gift_cards')
    .select([
      db.fn.sum('initial_balance').as('total_initial'),
      db.fn.sum('current_balance').as('total_balance'),
      db.fn.count('id').as('card_count'),
    ])
    .where('is_active', '=', true)
    .where('status', '=', 'ACTIVE')
    .where(eb => eb.or([
      eb('expiry_date', '>=', toTimestamp(today)),
      eb('expiry_date', 'is', null),
    ]))
    .where('created_at', '>=', formatDate(currentPeriodStart))
    .where('created_at', '<=', formatDate(today))
    .executeTakeFirst()

  // Get values for previous period
  const previousPeriodValues = await db
    .selectFrom('gift_cards')
    .select([
      db.fn.sum('initial_balance').as('total_initial'),
      db.fn.sum('current_balance').as('total_balance'),
      db.fn.count('id').as('card_count'),
    ])
    .where('is_active', '=', true)
    .where('status', '=', 'ACTIVE')
    .where(eb => eb.or([
      eb('expiry_date', '>=', toTimestamp(previousPeriodStart)),
      eb('expiry_date', 'is', null),
    ]))
    .where('created_at', '>=', formatDate(previousPeriodStart))
    .where('created_at', '<=', formatDate(previousPeriodEnd))
    .executeTakeFirst()

  // Calculate values for current period
  const currentInitialValue = Number(currentPeriodValues?.total_initial || 0)
  const currentBalance = Number(currentPeriodValues?.total_balance || 0)
  const currentCardCount = Number(currentPeriodValues?.card_count || 0)

  // Calculate values for previous period
  const previousInitialValue = Number(previousPeriodValues?.total_initial || 0)
  const previousBalance = Number(previousPeriodValues?.total_balance || 0)
  const previousCardCount = Number(previousPeriodValues?.card_count || 0)

  // Calculate utilization rates (percentage of gift card value that has been spent)
  const currentUtilizationRate = currentInitialValue > 0
    ? ((currentInitialValue - currentBalance) / currentInitialValue) * 100
    : 0

  const previousUtilizationRate = previousInitialValue > 0
    ? ((previousInitialValue - previousBalance) / previousInitialValue) * 100
    : 0

  // Calculate averages
  const currentAverageInitial = currentCardCount > 0 ? currentInitialValue / currentCardCount : 0
  const currentAverageBalance = currentCardCount > 0 ? currentBalance / currentCardCount : 0

  // Calculate differences
  const initialValueDifference = currentInitialValue - previousInitialValue
  const balanceDifference = currentBalance - previousBalance
  const cardCountDifference = currentCardCount - previousCardCount

  // Calculate percentage changes
  const initialValuePercentageChange = previousInitialValue !== 0
    ? (initialValueDifference / previousInitialValue) * 100
    : (currentInitialValue > 0 ? 100 : 0)

  const balancePercentageChange = previousBalance !== 0
    ? (balanceDifference / previousBalance) * 100
    : (currentBalance > 0 ? 100 : 0)

  const cardCountPercentageChange = previousCardCount !== 0
    ? (cardCountDifference / previousCardCount) * 100
    : (currentCardCount > 0 ? 100 : 0)

  return {
    current_period: {
      total_initial_value: currentInitialValue,
      total_remaining_balance: currentBalance,
      utilization_rate: currentUtilizationRate,
      card_count: currentCardCount,
      average_initial_value: currentAverageInitial,
      average_remaining_balance: currentAverageBalance,
    },
    previous_period: {
      total_initial_value: previousInitialValue,
      total_remaining_balance: previousBalance,
      utilization_rate: previousUtilizationRate,
      card_count: previousCardCount,
    },
    comparison: {
      initial_value: {
        difference: initialValueDifference,
        percentage: Math.abs(initialValuePercentageChange),
        is_increase: initialValueDifference >= 0,
      },
      balance: {
        difference: balanceDifference,
        percentage: Math.abs(balancePercentageChange),
        is_increase: balanceDifference >= 0,
      },
      card_count: {
        difference: cardCountDifference,
        percentage: Math.abs(cardCountPercentageChange),
        is_increase: cardCountDifference >= 0,
      },
    },
    days_range: daysRange,
  }
}

/**
 * Get total value of all gift cards
 */
export async function fetchTotalValue(): Promise<{
  total_value: number
}> {
  const totalValue = await db
    .selectFrom('gift_cards')
    .select(db.fn.sum('initial_balance').as('total_value'))
    .executeTakeFirst()

  return {
    total_value: Number(totalValue?.total_value || 0),
  }
}

/**
 * Get total current balance of all gift cards
 */
export async function fetchTotalCurrentBalance(): Promise<{
  total_balance: number
}> {
  const totalBalance = await db
    .selectFrom('gift_cards')
    .select(db.fn.sum('current_balance').as('total_balance'))
    .executeTakeFirst()

  return {
    total_balance: Number(totalBalance?.total_balance || 0),
  }
}
