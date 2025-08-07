import type { AuthorModel } from '../orm/src/models/Author'
import type { CartModel } from '../orm/src/models/Cart'
import type { CartItemModel } from '../orm/src/models/CartItem'
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
import type { PrintDeviceModel } from '../orm/src/models/PrintDevice'
import type { ProductModel } from '../orm/src/models/Product'
import type { ProductUnitModel } from '../orm/src/models/ProductUnit'
import type { ProductVariantModel } from '../orm/src/models/ProductVariant'
import type { ReceiptModel } from '../orm/src/models/Receipt'
import type { ReviewModel } from '../orm/src/models/Review'
import type { ShippingMethodModel } from '../orm/src/models/ShippingMethod'
import type { ShippingRateModel } from '../orm/src/models/ShippingRate'
import type { ShippingZoneModel } from '../orm/src/models/ShippingZone'
import type { TaxRateModel } from '../orm/src/models/TaxRate'
import type { TransactionModel } from '../orm/src/models/Transaction'
import type { WaitlistProductModel } from '../orm/src/models/WaitlistProduct'
import type { WaitlistRestaurantModel } from '../orm/src/models/WaitlistRestaurant'
import type { WebsocketModel } from '../orm/src/models/Websocket'

export interface ModelEvents {

  'print-device:created': PrintDeviceModel
  'print-device:updated': PrintDeviceModel
  'print-device:deleted': PrintDeviceModel
  'category:created': CategoryModel
  'category:updated': CategoryModel
  'category:deleted': CategoryModel
  'payment:created': PaymentModel
  'payment:updated': PaymentModel
  'payment:deleted': PaymentModel
  'driver:created': DriverModel
  'driver:updated': DriverModel
  'driver:deleted': DriverModel
  'waitlist-product:created': WaitlistProductModel
  'waitlist-product:updated': WaitlistProductModel
  'waitlist-product:deleted': WaitlistProductModel
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
  'receipt:created': ReceiptModel
  'receipt:updated': ReceiptModel
  'receipt:deleted': ReceiptModel
  'product-variant:created': ProductVariantModel
  'product-variant:updated': ProductVariantModel
  'product-variant:deleted': ProductVariantModel
  'license-key:created': LicenseKeyModel
  'license-key:updated': LicenseKeyModel
  'license-key:deleted': LicenseKeyModel
  'waitlist-restaurant:created': WaitlistRestaurantModel
  'waitlist-restaurant:updated': WaitlistRestaurantModel
  'waitlist-restaurant:deleted': WaitlistRestaurantModel
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
  'tax-rate:created': TaxRateModel
  'tax-rate:updated': TaxRateModel
  'tax-rate:deleted': TaxRateModel
  'transaction:created': TransactionModel
  'transaction:updated': TransactionModel
  'transaction:deleted': TransactionModel
  'loyalty-point:created': LoyaltyPointModel
  'loyalty-point:updated': LoyaltyPointModel
  'loyalty-point:deleted': LoyaltyPointModel
  'loyalty-reward:created': LoyaltyRewardModel
  'loyalty-reward:updated': LoyaltyRewardModel
  'loyalty-reward:deleted': LoyaltyRewardModel
  'shipping-method:created': ShippingMethodModel
  'shipping-method:updated': ShippingMethodModel
  'shipping-method:deleted': ShippingMethodModel
  'shipping-rate:created': ShippingRateModel
  'shipping-rate:updated': ShippingRateModel
  'shipping-rate:deleted': ShippingRateModel
  'cart:created': CartModel
  'cart:updated': CartModel
  'cart:deleted': CartModel
  'delivery-route:created': DeliveryRouteModel
  'delivery-route:updated': DeliveryRouteModel
  'delivery-route:deleted': DeliveryRouteModel
  'cart-item:created': CartItemModel
  'cart-item:updated': CartItemModel
  'cart-item:deleted': CartItemModel
  'author:created': AuthorModel
  'author:updated': AuthorModel
  'author:deleted': AuthorModel
  'websocket:created': WebsocketModel
  'websocket:updated': WebsocketModel
  'websocket:deleted': WebsocketModel

}
