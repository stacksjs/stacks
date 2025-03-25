import type { CategoryModel } from '../orm/src/models/Category'
import type { CouponModel } from '../orm/src/models/Coupon'
import type { CustomerModel } from '../orm/src/models/Customer'
import type { DeliveryRouteModel } from '../orm/src/models/DeliveryRoute'
import type { DigitalDeliveryModel } from '../orm/src/models/DigitalDelivery'
import type { DriverModel } from '../orm/src/models/Driver'
import type { GiftCardModel } from '../orm/src/models/GiftCard'
import type { LicenseKeyModel } from '../orm/src/models/LicenseKey'
import type { LoyaltyPointModel } from '../orm/src/models/LoyaltyPoint'
import type { LoyaltyRewardModel } from '../orm/src/models/LoyaltyReward'
import type { ManufacturerModel } from '../orm/src/models/Manufacturer'
import type { OrderModel } from '../orm/src/models/Order'
import type { PaymentModel } from '../orm/src/models/Payment'
import type { ProductModel } from '../orm/src/models/Product'
import type { ProductItemModel } from '../orm/src/models/ProductItem'
import type { ProductUnitModel } from '../orm/src/models/ProductUnit'
import type { ProductVariantModel } from '../orm/src/models/ProductVariant'
import type { ReviewModel } from '../orm/src/models/Review'
import type { ShippingMethodModel } from '../orm/src/models/ShippingMethod'
import type { ShippingRateModel } from '../orm/src/models/ShippingRate'
import type { ShippingZoneModel } from '../orm/src/models/ShippingZone'
import type { TransactionModel } from '../orm/src/models/Transaction'
import type { UserModel } from '../orm/src/models/User'

export interface ModelEvents {

  'user:created': UserModel
  'user:updated': UserModel
  'user:deleted': UserModel
  'category:created': CategoryModel
  'category:updated': CategoryModel
  'category:deleted': CategoryModel
  'payment:created': PaymentModel
  'payment:updated': PaymentModel
  'payment:deleted': PaymentModel
  'driver:created': DriverModel
  'driver:updated': DriverModel
  'driver:deleted': DriverModel
  'digital-delivery:created': DigitalDeliveryModel
  'digital-delivery:updated': DigitalDeliveryModel
  'digital-delivery:deleted': DigitalDeliveryModel
  'manufacturer:created': ManufacturerModel
  'manufacturer:updated': ManufacturerModel
  'manufacturer:deleted': ManufacturerModel
  'shipping-zone:created': ShippingZoneModel
  'shipping-zone:updated': ShippingZoneModel
  'shipping-zone:deleted': ShippingZoneModel
  'customer:created': CustomerModel
  'customer:updated': CustomerModel
  'customer:deleted': CustomerModel
  'product:created': ProductModel
  'product:updated': ProductModel
  'product:deleted': ProductModel
  'product-variant:created': ProductVariantModel
  'product-variant:updated': ProductVariantModel
  'product-variant:deleted': ProductVariantModel
  'license-key:created': LicenseKeyModel
  'license-key:updated': LicenseKeyModel
  'license-key:deleted': LicenseKeyModel
  'review:created': ReviewModel
  'review:updated': ReviewModel
  'review:deleted': ReviewModel
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
  'shipping-method:created': ShippingMethodModel
  'shipping-method:updated': ShippingMethodModel
  'shipping-method:deleted': ShippingMethodModel
  'shipping-rate:created': ShippingRateModel
  'shipping-rate:updated': ShippingRateModel
  'shipping-rate:deleted': ShippingRateModel
  'delivery-route:created': DeliveryRouteModel
  'delivery-route:updated': DeliveryRouteModel
  'delivery-route:deleted': DeliveryRouteModel

}
