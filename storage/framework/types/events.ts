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
import type { ProductReviewModel } from '../orm/src/models/ProductReview'
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
  'productreview:created': ProductReviewModel
  'productreview:updated': ProductReviewModel
  'productreview:deleted': ProductReviewModel
  'product:created': ProductModel
  'product:updated': ProductModel
  'product:deleted': ProductModel
  'giftcard:created': GiftCardModel
  'giftcard:updated': GiftCardModel
  'giftcard:deleted': GiftCardModel
  'order:created': OrderModel
  'order:updated': OrderModel
  'order:deleted': OrderModel
  'coupon:created': CouponModel
  'coupon:updated': CouponModel
  'coupon:deleted': CouponModel
  'transaction:created': TransactionModel
  'transaction:updated': TransactionModel
  'transaction:deleted': TransactionModel
  'loyaltypoint:created': LoyaltyPointModel
  'loyaltypoint:updated': LoyaltyPointModel
  'loyaltypoint:deleted': LoyaltyPointModel
  'loyaltyreward:created': LoyaltyRewardModel
  'loyaltyreward:updated': LoyaltyRewardModel
  'loyaltyreward:deleted': LoyaltyRewardModel
  'productcategory:created': ProductCategoryModel
  'productcategory:updated': ProductCategoryModel
  'productcategory:deleted': ProductCategoryModel

}
