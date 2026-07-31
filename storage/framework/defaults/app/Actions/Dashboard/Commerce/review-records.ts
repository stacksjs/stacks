import {
  commerceBoolean,
  commerceEmail,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

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

export function normalizeReviewRecord(
  review: any,
  products: Map<string, { name: string }>,
  customers: Map<string, { name: string, email: string }>,
): ReviewRecord {
  const id = commerceIdentifier(commerceValue(review, 'id', 'uuid'), 'Review')
  const source = `Review ${id}`
  const productId = commerceOptionalIdentifier(
    commerceValue(review, 'product_id', 'productId'),
    source,
    'product_id',
  )
  const customerId = commerceOptionalIdentifier(
    commerceValue(review, 'customer_id', 'customerId'),
    source,
    'customer_id',
  )
  const product = products.get(productId)
  const customer = customers.get(customerId)
  if (productId && !product)
    throw new TypeError(`${source}.product_id references missing Product ${productId}.`)
  if (customerId && !customer)
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)

  return {
    id,
    productId,
    productName: product?.name || '',
    customerId,
    customerName: customer?.name || '',
    customerEmail: customer?.email || '',
    rating: commerceNumber(commerceValue(review, 'rating'), source, 'rating', {
      min: 1,
      max: 5,
      integer: true,
    }),
    title: commerceOptionalString(commerceValue(review, 'title'), source, 'title'),
    content: commerceOptionalString(commerceValue(review, 'content'), source, 'content'),
    approved: commerceBoolean(
      commerceValue(review, 'is_approved', 'isApproved'),
      source,
      'is_approved',
    ),
    featured: commerceBoolean(
      commerceValue(review, 'is_featured', 'isFeatured'),
      source,
      'is_featured',
    ),
    verifiedPurchase: commerceBoolean(
      commerceValue(review, 'is_verified_purchase', 'isVerifiedPurchase'),
      source,
      'is_verified_purchase',
    ),
    helpfulVotes: commerceNumber(
      commerceValue(review, 'helpful_votes', 'helpfulVotes'),
      source,
      'helpful_votes',
      { min: 0, integer: true },
    ),
    unhelpfulVotes: commerceNumber(
      commerceValue(review, 'unhelpful_votes', 'unhelpfulVotes'),
      source,
      'unhelpful_votes',
      { min: 0, integer: true },
    ),
    createdAt: commerceTimestamp(commerceValue(review, 'created_at', 'createdAt'), source),
  }
}

export function normalizeReviewProductOption(product: any): ReviewProductOption {
  const id = commerceIdentifier(commerceValue(product, 'id', 'uuid'), 'Product')
  return {
    id,
    label: commerceRequiredString(commerceValue(product, 'name'), `Product ${id}`, 'name'),
  }
}

export function normalizeReviewCustomerContext(customer: any): {
  id: string
  context: { name: string, email: string }
} {
  const id = commerceIdentifier(commerceValue(customer, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  return {
    id,
    context: {
      name: commerceRequiredString(commerceValue(customer, 'name'), source, 'name'),
      email: commerceEmail(commerceValue(customer, 'email'), source),
    },
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
