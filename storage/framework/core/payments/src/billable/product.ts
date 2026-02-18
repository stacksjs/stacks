/**
 * Product Management
 *
 * Handles Stripe product and price creation, retrieval, and management.
 */

import type Stripe from 'stripe'
import { stripe } from '..'

export interface ProductManager {
  create: (params: Stripe.ProductCreateParams) => Promise<Stripe.Response<Stripe.Product>>
  retrieve: (productId: string) => Promise<Stripe.Response<Stripe.Product>>
  update: (productId: string, params: Stripe.ProductUpdateParams) => Promise<Stripe.Response<Stripe.Product>>
  list: (params?: Stripe.ProductListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Product>>>
  archive: (productId: string) => Promise<Stripe.Response<Stripe.Product>>
  createWithPrice: (product: Stripe.ProductCreateParams, price: Omit<Stripe.PriceCreateParams, 'product'>) => Promise<{ product: Stripe.Product, price: Stripe.Price }>
  search: (query: string, params?: Stripe.ProductSearchParams) => Promise<Stripe.Response<Stripe.ApiSearchResult<Stripe.Product>>>
}

export const manageProduct: ProductManager = (() => {
  /**
   * Create a new product
   */
  async function create(params: Stripe.ProductCreateParams): Promise<Stripe.Response<Stripe.Product>> {
    return await stripe.products.create(params)
  }

  /**
   * Retrieve a product by ID
   */
  async function retrieve(productId: string): Promise<Stripe.Response<Stripe.Product>> {
    return await stripe.products.retrieve(productId)
  }

  /**
   * Update a product
   */
  async function update(
    productId: string,
    params: Stripe.ProductUpdateParams,
  ): Promise<Stripe.Response<Stripe.Product>> {
    return await stripe.products.update(productId, params)
  }

  /**
   * List all products
   */
  async function list(params: Stripe.ProductListParams = {}): Promise<Stripe.Response<Stripe.ApiList<Stripe.Product>>> {
    return await stripe.products.list({
      active: true,
      ...params,
    })
  }

  /**
   * Archive a product (soft delete)
   */
  async function archive(productId: string): Promise<Stripe.Response<Stripe.Product>> {
    return await stripe.products.update(productId, { active: false })
  }

  /**
   * Create a product with an associated price
   */
  async function createWithPrice(
    productParams: Stripe.ProductCreateParams,
    priceParams: Omit<Stripe.PriceCreateParams, 'product'>,
  ): Promise<{ product: Stripe.Product, price: Stripe.Price }> {
    const product = await stripe.products.create(productParams)

    const price = await stripe.prices.create({
      ...priceParams,
      product: product.id,
    })

    return { product, price }
  }

  /**
   * Search for products
   */
  async function search(
    query: string,
    params: Stripe.ProductSearchParams = { query: '' },
  ): Promise<Stripe.Response<Stripe.ApiSearchResult<Stripe.Product>>> {
    return await stripe.products.search({
      query,
      ...params,
    })
  }

  return { create, retrieve, update, list, archive, createWithPrice, search }
})()

// =============================================================================
// Extended Price Management
// =============================================================================

export interface ExtendedPriceManager {
  create: (params: Stripe.PriceCreateParams) => Promise<Stripe.Response<Stripe.Price>>
  retrieve: (priceId: string) => Promise<Stripe.Response<Stripe.Price>>
  update: (priceId: string, params: Stripe.PriceUpdateParams) => Promise<Stripe.Response<Stripe.Price>>
  list: (params?: Stripe.PriceListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Price>>>
  listByProduct: (productId: string, params?: Stripe.PriceListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Price>>>
  search: (query: string, params?: Stripe.PriceSearchParams) => Promise<Stripe.Response<Stripe.ApiSearchResult<Stripe.Price>>>
  archive: (priceId: string) => Promise<Stripe.Response<Stripe.Price>>
}

export const managePriceExtended: ExtendedPriceManager = (() => {
  /**
   * Create a new price
   */
  async function create(params: Stripe.PriceCreateParams): Promise<Stripe.Response<Stripe.Price>> {
    return await stripe.prices.create(params)
  }

  /**
   * Retrieve a price by ID
   */
  async function retrieve(priceId: string): Promise<Stripe.Response<Stripe.Price>> {
    return await stripe.prices.retrieve(priceId)
  }

  /**
   * Update a price
   */
  async function update(
    priceId: string,
    params: Stripe.PriceUpdateParams,
  ): Promise<Stripe.Response<Stripe.Price>> {
    return await stripe.prices.update(priceId, params)
  }

  /**
   * List all prices
   */
  async function list(params: Stripe.PriceListParams = {}): Promise<Stripe.Response<Stripe.ApiList<Stripe.Price>>> {
    return await stripe.prices.list({
      active: true,
      ...params,
    })
  }

  /**
   * List prices for a specific product
   */
  async function listByProduct(
    productId: string,
    params: Stripe.PriceListParams = {},
  ): Promise<Stripe.Response<Stripe.ApiList<Stripe.Price>>> {
    return await stripe.prices.list({
      product: productId,
      active: true,
      ...params,
    })
  }

  /**
   * Search for prices
   */
  async function search(
    query: string,
    params: Stripe.PriceSearchParams = { query: '' },
  ): Promise<Stripe.Response<Stripe.ApiSearchResult<Stripe.Price>>> {
    return await stripe.prices.search({
      query,
      ...params,
    })
  }

  /**
   * Archive a price (soft delete)
   */
  async function archive(priceId: string): Promise<Stripe.Response<Stripe.Price>> {
    return await stripe.prices.update(priceId, { active: false })
  }

  return { create, retrieve, update, list, listByProduct, search, archive }
})()

// =============================================================================
// Coupon and Promotion Code Management
// =============================================================================

export interface CouponManager {
  create: (params: Stripe.CouponCreateParams) => Promise<Stripe.Response<Stripe.Coupon>>
  retrieve: (couponId: string) => Promise<Stripe.Response<Stripe.Coupon>>
  update: (couponId: string, params: Stripe.CouponUpdateParams) => Promise<Stripe.Response<Stripe.Coupon>>
  delete: (couponId: string) => Promise<Stripe.Response<Stripe.DeletedCoupon>>
  list: (params?: Stripe.CouponListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Coupon>>>
  createPromotionCode: (params: Stripe.PromotionCodeCreateParams) => Promise<Stripe.Response<Stripe.PromotionCode>>
  retrievePromotionCode: (code: string) => Promise<Stripe.PromotionCode | null>
}

export const manageCoupon: CouponManager = (() => {
  /**
   * Create a coupon
   */
  async function create(params: Stripe.CouponCreateParams): Promise<Stripe.Response<Stripe.Coupon>> {
    return await stripe.coupons.create(params)
  }

  /**
   * Retrieve a coupon by ID
   */
  async function retrieve(couponId: string): Promise<Stripe.Response<Stripe.Coupon>> {
    return await stripe.coupons.retrieve(couponId)
  }

  /**
   * Update a coupon
   */
  async function update(
    couponId: string,
    params: Stripe.CouponUpdateParams,
  ): Promise<Stripe.Response<Stripe.Coupon>> {
    return await stripe.coupons.update(couponId, params)
  }

  /**
   * Delete a coupon
   */
  async function deleteCoupon(couponId: string): Promise<Stripe.Response<Stripe.DeletedCoupon>> {
    return await stripe.coupons.del(couponId)
  }

  /**
   * List all coupons
   */
  async function list(params: Stripe.CouponListParams = {}): Promise<Stripe.Response<Stripe.ApiList<Stripe.Coupon>>> {
    return await stripe.coupons.list(params)
  }

  /**
   * Create a promotion code for a coupon
   */
  async function createPromotionCode(params: Stripe.PromotionCodeCreateParams): Promise<Stripe.Response<Stripe.PromotionCode>> {
    return await stripe.promotionCodes.create(params)
  }

  /**
   * Retrieve a promotion code by its code string
   */
  async function retrievePromotionCode(code: string): Promise<Stripe.PromotionCode | null> {
    try {
      const promotionCodes = await stripe.promotionCodes.list({
        code,
        active: true,
      })

      if (promotionCodes.data.length > 0) {
        return promotionCodes.data[0]
      }

      return null
    }
    catch {
      return null
    }
  }

  return { create, retrieve, update, delete: deleteCoupon, list, createPromotionCode, retrievePromotionCode }
})()
