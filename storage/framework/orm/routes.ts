import { route } from '@stacksjs/router'

route.get('users', 'UserIndexOrmAction')

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction')

route.get('payments', 'PaymentIndexOrmAction')

route.post('payments', 'PaymentStoreOrmAction')

route.get('payments/{id}', 'PaymentShowOrmAction')

route.get('product-manufacturers', 'ManufacturerIndexOrmAction')

route.post('product-manufacturers', 'ManufacturerStoreOrmAction')

route.get('product-manufacturers/{id}', 'ManufacturerShowOrmAction')

route.get('customers', 'CustomerIndexOrmAction')

route.post('customers', 'CustomerStoreOrmAction')

route.get('customers/{id}', 'CustomerShowOrmAction')

route.patch('customers/{id}', 'CustomerUpdateOrmAction')

route.delete('customers/{id}', 'CustomerDestroyOrmAction')

route.get('product-reviews', 'ProductReviewIndexOrmAction')

route.post('product-reviews', 'ProductReviewStoreOrmAction')

route.get('product-reviews/{id}', 'ProductReviewShowOrmAction')

route.get('products', 'ProductIndexOrmAction')

route.post('products', 'ProductStoreOrmAction')

route.get('products/{id}', 'ProductShowOrmAction')

route.get('product-variants', 'ProductVariantIndexOrmAction')

route.post('product-variants', 'ProductVariantStoreOrmAction')

route.get('product-variants/{id}', 'ProductVariantShowOrmAction')

route.patch('product-variants/{id}', 'ProductVariantUpdateOrmAction')

route.delete('product-variants/{id}', 'ProductVariantDestroyOrmAction')

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

route.get('product-categories', 'ProductCategoryIndexOrmAction')

route.post('product-categories', 'ProductCategoryStoreOrmAction')

route.get('product-categories/{id}', 'ProductCategoryShowOrmAction')

route.get('requests', 'storage/framework/actions/src/RequestIndexOrmAction.ts')

route.get('requests/{id}', 'storage/framework/actions/src/RequestShowOrmAction.ts')

route.post('requests', 'storage/framework/actions/src/RequestStoreOrmAction.ts')

route.patch('requests/{id}', 'storage/framework/actions/src/RequestUpdateOrmAction.ts')

route.delete('requests/{id}', 'storage/framework/actions/src/RequestDestroyOrmAction.ts')
