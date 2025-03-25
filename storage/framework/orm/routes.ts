import { route } from '@stacksjs/router'

route.get('users', 'UserIndexOrmAction')

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction')

route.get('product-categories', 'CategoryIndexOrmAction')

route.post('product-categories', 'CategoryStoreOrmAction')

route.get('product-categories/{id}', 'CategoryShowOrmAction')

route.get('payments', 'PaymentIndexOrmAction')

route.post('payments', 'PaymentStoreOrmAction')

route.get('payments/{id}', 'PaymentShowOrmAction')

route.get('digital-deliveries', 'DigitalDeliveryIndexOrmAction')

route.post('digital-deliveries', 'DigitalDeliveryStoreOrmAction')

route.get('digital-deliveries/{id}', 'DigitalDeliveryShowOrmAction')

route.patch('digital-deliveries/{id}', 'DigitalDeliveryUpdateOrmAction')

route.delete('digital-deliveries/{id}', 'DigitalDeliveryDestroyOrmAction')

route.get('product-manufacturers', 'ManufacturerIndexOrmAction')

route.post('product-manufacturers', 'ManufacturerStoreOrmAction')

route.get('product-manufacturers/{id}', 'ManufacturerShowOrmAction')

route.get('shipping-zones', 'ShippingZoneIndexOrmAction')

route.post('shipping-zones', 'ShippingZoneStoreOrmAction')

route.get('shipping-zones/{id}', 'ShippingZoneShowOrmAction')

route.patch('shipping-zones/{id}', 'ShippingZoneUpdateOrmAction')

route.delete('shipping-zones/{id}', 'ShippingZoneDestroyOrmAction')

route.get('customers', 'CustomerIndexOrmAction')

route.post('customers', 'CustomerStoreOrmAction')

route.get('customers/{id}', 'CustomerShowOrmAction')

route.patch('customers/{id}', 'CustomerUpdateOrmAction')

route.delete('customers/{id}', 'CustomerDestroyOrmAction')

route.get('products', 'ProductIndexOrmAction')

route.post('products', 'ProductStoreOrmAction')

route.get('products/{id}', 'ProductShowOrmAction')

route.get('product-variants', 'ProductVariantIndexOrmAction')

route.post('product-variants', 'ProductVariantStoreOrmAction')

route.get('product-variants/{id}', 'ProductVariantShowOrmAction')

route.patch('product-variants/{id}', 'ProductVariantUpdateOrmAction')

route.delete('product-variants/{id}', 'ProductVariantDestroyOrmAction')

route.get('license-keys', 'LicenseKeyIndexOrmAction')

route.post('license-keys', 'LicenseKeyStoreOrmAction')

route.get('license-keys/{id}', 'LicenseKeyShowOrmAction')

route.patch('license-keys/{id}', 'LicenseKeyUpdateOrmAction')

route.delete('license-keys/{id}', 'LicenseKeyDestroyOrmAction')

route.get('product-reviews', 'ReviewIndexOrmAction')

route.post('product-reviews', 'ReviewStoreOrmAction')

route.get('product-reviews/{id}', 'ReviewShowOrmAction')

route.get('product-units', 'ProductUnitIndexOrmAction')

route.post('product-units', 'ProductUnitStoreOrmAction')

route.get('product-units/{id}', 'ProductUnitShowOrmAction')

route.get('gift-cards', 'GiftCardIndexOrmAction')

route.post('gift-cards', 'GiftCardStoreOrmAction')

route.get('gift-cards/{id}', 'GiftCardShowOrmAction')

route.get('orders', 'OrderIndexOrmAction')

route.post('orders', 'OrderStoreOrmAction')

route.get('orders/{id}', 'OrderShowOrmAction')

route.get('coupons', 'CouponIndexOrmAction')

route.post('coupons', 'CouponStoreOrmAction')

route.get('coupons/{id}', 'CouponShowOrmAction')

route.get('transactions', 'TransactionIndexOrmAction')

route.post('transactions', 'TransactionStoreOrmAction')

route.get('transactions/{id}', 'TransactionShowOrmAction')

route.get('loyalty-points', 'LoyaltyPointIndexOrmAction')

route.post('loyalty-points', 'LoyaltyPointStoreOrmAction')

route.get('loyalty-points/{id}', 'LoyaltyPointShowOrmAction')

route.get('product-items', 'ProductItemIndexOrmAction')

route.post('product-items', 'ProductItemStoreOrmAction')

route.get('product-items/{id}', 'ProductItemShowOrmAction')

route.get('loyalty-rewards', 'LoyaltyRewardIndexOrmAction')

route.post('loyalty-rewards', 'LoyaltyRewardStoreOrmAction')

route.get('loyalty-rewards/{id}', 'LoyaltyRewardShowOrmAction')

route.get('shipping-methods', 'ShippingMethodIndexOrmAction')

route.post('shipping-methods', 'ShippingMethodStoreOrmAction')

route.get('shipping-methods/{id}', 'ShippingMethodShowOrmAction')

route.patch('shipping-methods/{id}', 'ShippingMethodUpdateOrmAction')

route.delete('shipping-methods/{id}', 'ShippingMethodDestroyOrmAction')

route.get('shipping-rates', 'ShippingRateIndexOrmAction')

route.post('shipping-rates', 'ShippingRateStoreOrmAction')

route.get('shipping-rates/{id}', 'ShippingRateShowOrmAction')

route.patch('shipping-rates/{id}', 'ShippingRateUpdateOrmAction')

route.delete('shipping-rates/{id}', 'ShippingRateDestroyOrmAction')

route.get('delivery-routes', 'DeliveryRouteIndexOrmAction')

route.post('delivery-routes', 'DeliveryRouteStoreOrmAction')

route.get('delivery-routes/{id}', 'DeliveryRouteShowOrmAction')

route.patch('delivery-routes/{id}', 'DeliveryRouteUpdateOrmAction')

route.delete('delivery-routes/{id}', 'DeliveryRouteDestroyOrmAction')

route.get('requests', 'storage/framework/actions/src/RequestIndexOrmAction.ts')

route.get('requests/{id}', 'storage/framework/actions/src/RequestShowOrmAction.ts')

route.post('requests', 'storage/framework/actions/src/RequestStoreOrmAction.ts')

route.patch('requests/{id}', 'storage/framework/actions/src/RequestUpdateOrmAction.ts')

route.delete('requests/{id}', 'storage/framework/actions/src/RequestDestroyOrmAction.ts')
