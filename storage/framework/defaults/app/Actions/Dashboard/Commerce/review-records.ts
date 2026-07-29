export interface ReviewRecord {
  id: string
  productId: string
  productName: string
  customerId: string
  customerName: string
  customerEmail: string
  rating: number
  title: string
  content: string
  approved: boolean
  featured: boolean
  verifiedPurchase: boolean
  helpfulVotes: number
  unhelpfulVotes: number
  createdAt: string
}

export interface ReviewSummary {
  total: number
  approved: number
  pending: number
  featured: number
  verified: number
  averageRating: number
}

export interface ReviewProductOption {
  id: string
  label: string
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function boolean(input: unknown): boolean {
  return input === true || input === 1 || input === '1' || input === 'true'
}

function nonNegativeNumber(input: unknown): number {
  const number = Number(input)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

export function normalizeReviewRecord(
  review: any,
  products: Map<string, { name: string }>,
  customers: Map<string, { name: string, email: string }>,
): ReviewRecord {
  const productId = text(value(review, 'product_id', 'productId'))
  const customerId = text(value(review, 'customer_id', 'customerId'))
  const product = products.get(productId)
  const customer = customers.get(customerId)
  const rating = Math.min(5, Math.max(0, nonNegativeNumber(value(review, 'rating'))))

  return {
    id: text(value(review, 'id', 'uuid')),
    productId,
    productName: product?.name || (productId ? `Product ${productId}` : 'Unlinked product'),
    customerId,
    customerName: customer?.name || (customerId ? `Customer ${customerId}` : 'Guest customer'),
    customerEmail: customer?.email || '',
    rating,
    title: text(value(review, 'title')),
    content: text(value(review, 'content')),
    approved: boolean(value(review, 'is_approved', 'isApproved')),
    featured: boolean(value(review, 'is_featured', 'isFeatured')),
    verifiedPurchase: boolean(value(review, 'is_verified_purchase', 'isVerifiedPurchase')),
    helpfulVotes: nonNegativeNumber(value(review, 'helpful_votes', 'helpfulVotes')),
    unhelpfulVotes: nonNegativeNumber(value(review, 'unhelpful_votes', 'unhelpfulVotes')),
    createdAt: text(value(review, 'created_at', 'createdAt')),
  }
}

export function normalizeReviewProductOption(product: any): ReviewProductOption {
  return {
    id: text(value(product, 'id')),
    label: text(value(product, 'name')) || 'Unnamed product',
  }
}

export function summarizeReviews(records: ReviewRecord[]): ReviewSummary {
  const totalRating = records.reduce((sum, review) => sum + review.rating, 0)
  return {
    total: records.length,
    approved: records.filter(review => review.approved).length,
    pending: records.filter(review => !review.approved).length,
    featured: records.filter(review => review.featured).length,
    verified: records.filter(review => review.verifiedPurchase).length,
    averageRating: records.length > 0
      ? Math.round(totalRating / records.length * 10) / 10
      : 0,
  }
}
