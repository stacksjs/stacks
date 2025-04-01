import type { CategoryJsonResponse } from '@stacksjs/orm'
import type { CategoryStats } from '../../types'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Fetch all categories from the database
 */
export async function fetchAll(): Promise<CategoryJsonResponse[]> {
  const categories = await db
    .selectFrom('categories')
    .selectAll()
    .execute()

  return categories
}

/**
 * Fetch a category by ID
 */
export async function fetchById(id: number): Promise<CategoryJsonResponse | undefined> {
  return await db
    .selectFrom('categories')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch a category by name
 */
export async function fetchByName(name: string): Promise<CategoryJsonResponse | undefined> {
  return await db
    .selectFrom('categories')
    .where('name', '=', name)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch active categories (is_active = true)
 */
export async function fetchActive(): Promise<CategoryJsonResponse[]> {
  const categories = await db
    .selectFrom('categories')
    .where('is_active', '=', true)
    .selectAll()
    .execute()

  return categories
}

/**
 * Fetch root categories (parent_category_id is null)
 */
export async function fetchRootCategories(): Promise<CategoryJsonResponse[]> {
  const categories = await db
    .selectFrom('categories')
    .where('parent_category_id', 'is', null)
    .where('is_active', '=', true)
    .selectAll()
    .execute()

  return categories
}

/**
 * Fetch child categories for a given parent category ID
 */
export async function fetchChildCategories(parentId: string): Promise<CategoryJsonResponse[]> {
  const categories = await db
    .selectFrom('categories')
    .where('parent_category_id', '=', parentId)
    .where('is_active', '=', true)
    .selectAll()
    .execute()

  return categories
}

/**
 * Fetch categories sorted by display order
 */
export async function fetchByDisplayOrder(ascending: boolean = true): Promise<CategoryJsonResponse[]> {
  const query = db
    .selectFrom('categories')
    .where('is_active', '=', true)
    .selectAll()

  if (ascending) {
    return await query.orderBy('display_order', 'asc').execute()
  }
  else {
    return await query.orderBy('display_order', 'desc').execute()
  }
}

/**
 * Get category statistics
 */
export async function fetchStats(): Promise<CategoryStats> {
  // Total categories
  const totalCategories = await db
    .selectFrom('categories')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Active categories
  const activeCategories = await db
    .selectFrom('categories')
    .where('is_active', '=', true)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Root vs child categories
  const rootCategories = await db
    .selectFrom('categories')
    .where('parent_category_id', 'is', null)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Categories with images
  const categoriesWithImages = await db
    .selectFrom('categories')
    .where('image_url', 'is not', null)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Recently added categories (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = formatDate(thirtyDaysAgo)

  const recentlyAddedCategories = await db
    .selectFrom('categories')
    .where('created_at', '>=', thirtyDaysAgoStr)
    .selectAll()
    .limit(5)
    .execute()

  // Categories by parent (top 5 parents with most children)
  const categoriesByParent = await db
    .selectFrom('categories as c')
    .leftJoin('categories as parent', 'c.parent_category_id', 'parent.id')
    .where('c.parent_category_id', 'is not', null)
    .select([
      'c.parent_category_id',
      'parent.name as parent_name',
      eb => eb.fn.count('c.id').as('child_count'),
    ])
    .groupBy(['c.parent_category_id', 'parent.name'])
    .orderBy('child_count', 'desc')
    .limit(5)
    .execute()

  return {
    total: Number(totalCategories?.count || 0),
    active: Number(activeCategories?.count || 0),
    root_categories: Number(rootCategories?.count || 0),
    child_categories: Number(totalCategories?.count || 0) - Number(rootCategories?.count || 0),
    with_images: Number(categoriesWithImages?.count || 0),
    recently_added: recentlyAddedCategories,
    top_parent_categories: categoriesByParent.map(item => ({
      id: String(item.parent_category_id || ''),
      name: String(item.parent_name || ''),
      child_count: Number(item.child_count),
    })),
  }
}

/**
 * Compare category growth between different time periods
 * @param daysRange Number of days to look back (7, 30, 60, etc.)
 */
export async function compareCategoryGrowth(daysRange: number = 30): Promise<{
  current_period: number
  previous_period: number
  difference: number
  percentage_change: number
  days_range: number
}> {
  const today = new Date()
  const todayStr = formatDate(today)

  // Current period (last N days)
  const currentPeriodStart = new Date()
  currentPeriodStart.setDate(today.getDate() - daysRange)
  const currentPeriodStartStr = formatDate(currentPeriodStart)

  // Previous period (N days before the current period)
  const previousPeriodEnd = new Date(currentPeriodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)
  const previousPeriodEndStr = formatDate(previousPeriodEnd)

  const previousPeriodStart = new Date(previousPeriodEnd)
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysRange)
  const previousPeriodStartStr = formatDate(previousPeriodStart)

  // Get categories for current period
  const currentPeriodCategories = await db
    .selectFrom('categories')
    .select(db.fn.count('id').as('count'))
    .where('created_at', '>=', currentPeriodStartStr)
    .where('created_at', '<=', todayStr)
    .executeTakeFirst()

  // Get categories for previous period
  const previousPeriodCategories = await db
    .selectFrom('categories')
    .select(db.fn.count('id').as('count'))
    .where('created_at', '>=', previousPeriodStartStr)
    .where('created_at', '<=', previousPeriodEndStr)
    .executeTakeFirst()

  const currentCount = Number(currentPeriodCategories?.count || 0)
  const previousCount = Number(previousPeriodCategories?.count || 0)
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
 * Build category tree structure
 */
export async function fetchCategoryTree(): Promise<any[]> {
  // First get all categories
  const allCategories = await fetchAll()

  // Create a map for quick access
  const categoryMap = new Map()
  allCategories.forEach((category) => {
    categoryMap.set(category.id, {
      ...category,
      children: [],
    })
  })

  // Build the tree
  const rootCategories: any[] = []

  allCategories.forEach((category) => {
    const categoryWithChildren = categoryMap.get(category.id)

    if (category.parent_category_id) {
      // This is a child category
      const parent = categoryMap.get(category.parent_category_id)
      if (parent) {
        parent.children.push(categoryWithChildren)
      }
    }
    else {
      // This is a root category
      rootCategories.push(categoryWithChildren)
    }
  })

  // Sort root categories by display_order
  rootCategories.sort((a, b) => a.display_order - b.display_order)

  // Sort children by display_order
  const sortChildrenByDisplayOrder = (categories: any[]) => {
    categories.sort((a, b) => a.display_order - b.display_order)
    categories.forEach((category) => {
      if (category.children.length > 0) {
        sortChildrenByDisplayOrder(category.children)
      }
    })
  }

  sortChildrenByDisplayOrder(rootCategories)

  return rootCategories
}
