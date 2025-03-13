import type { CouponModel } from '../orm/src/models/Coupon'
import type { CustomerModel } from '../orm/src/models/Customer'
import type { GiftCardModel } from '../orm/src/models/GiftCard'
import type { LoyaltyPointModel } from '../orm/src/models/LoyaltyPoint'
import type { LoyaltyRewardModel } from '../orm/src/models/LoyaltyReward'
import type { ManufacturerModel } from '../orm/src/models/Manufacturer'
import type { OrderModel } from '../orm/src/models/Order'
import type { PaymentModel } from '../orm/src/models/Payment'
import type { ProductModel } from '../orm/src/models/Product'
import type { ProductCategoryModel } from '../orm/src/models/ProductCategory'
import type { ProductItemModel } from '../orm/src/models/ProductItem'
import type { ProductReviewModel } from '../orm/src/models/ProductReview'
import type { ProductUnitModel } from '../orm/src/models/ProductUnit'
import type { ProductVariantModel } from '../orm/src/models/ProductVariant'
import type { TransactionModel } from '../orm/src/models/Transaction'
import type { UserModel } from '../orm/src/models/User'

export interface ModelEvents {

  'user:created': UserModel
  'user:updated': UserModel
  'user:deleted': UserModel
  'payment:created': PaymentModel
  'payment:updated': PaymentModel
  'payment:deleted': PaymentModel
  'manufacturer:created': ManufacturerModel
  'manufacturer:updated': ManufacturerModel
  'manufacturer:deleted': ManufacturerModel
  'customer:created': CustomerModel
  'customer:updated': CustomerModel
  'customer:deleted': CustomerModel
  'product-review:created': ProductReviewModel
  'product-review:updated': ProductReviewModel
  'product-review:deleted': ProductReviewModel
  'product:created': ProductModel
  'product:updated': ProductModel
  'product:deleted': ProductModel
  'product-variant:created': ProductVariantModel
  'product-variant:updated': ProductVariantModel
  'product-variant:deleted': ProductVariantModel
  'product-unit:created': ProductUnitModel
  'product-unit:updated': ProductUnitModel
  'product-unit:deleted': ProductUnitModel
  'gift-card:created': GiftCardModel
  'gift-card:updated': GiftCardModel
  'gift-card:deleted': GiftCardModel
  'order:created': OrderModel
  'order:updated': OrderModel
  'order:deleted': OrderModel
  'coupon:created': CouponModel
  'coupon:updated': CouponModel
  'coupon:deleted': CouponModel
  'transaction:created': TransactionModel
  'transaction:updated': TransactionModel
  'transaction:deleted': TransactionModel
  'loyalty-point:created': LoyaltyPointModel
  'loyalty-point:updated': LoyaltyPointModel
  'loyalty-point:deleted': LoyaltyPointModel
  'product-item:created': ProductItemModel
  'product-item:updated': ProductItemModel
  'product-item:deleted': ProductItemModel
  'loyalty-reward:created': LoyaltyRewardModel
  'loyalty-reward:updated': LoyaltyRewardModel
  'loyalty-reward:deleted': LoyaltyRewardModel
  'product-category:created': ProductCategoryModel
  'product-category:updated': ProductCategoryModel
  'product-category:deleted': ProductCategoryModel

}
