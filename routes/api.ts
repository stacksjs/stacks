import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://docs.stacksjs.org/routing
 */

route.get('/foo/bar/{id}', () => 'hello world, foo bar') // $API_URL/hello/world
route.get('/', () => 'hello world') // $API_URL
route.get('/hello/world', () => 'hello world, buddy') // $API_URL/hello/world

route.post('/email/subscribe', 'Actions/SubscriberEmailAction')
route.post('/login', 'Actions/Auth/LoginAction')
route.post('/register', 'Actions/Auth/RegisterAction')
route.post('/logout', 'Actions/Auth/LogoutAction')
route.get('/generate-registration-options', 'Actions/Auth/GenerateRegistrationAction')
route.post('/verify-registration', 'Actions/Auth/VerifyRegistrationAction')
route.get('/generate-authentication-options', 'Actions/Auth/GenerateAuthenticationAction')
route.post('/verify-authentication', 'Actions/Auth/VerifyAuthenticationAction')

route.get('/coming-soon', 'Controllers/ComingSoonController@index')

// route.email('/welcome')
route.health() // adds a GET `/health` route
route.get('/install', 'Actions/InstallAction')
route.post('/ai/ask', 'Actions/AI/AskAction')
route.post('/ai/summary', 'Actions/AI/SummaryAction')

route.group({ prefix: '/payments' }, async () => {
  route.get('/fetch-customer/{id}', 'Actions/Payment/FetchPaymentCustomerAction')
  route.get('/fetch-transaction-history/{id}', 'Actions/Payment/FetchTransactionHistoryAction')
  route.get('/fetch-user-subscriptions/{id}', 'Actions/Payment/FetchUserSubscriptionsAction')
  route.get('/fetch-active-subscription/{id}', 'Actions/Payment/FetchActiveSubscriptionAction')
  route.get('/default-payment-method/{id}', 'Actions/Payment/FetchDefaultPaymentMethodAction')
  route.get('/payment-methods/{id}', 'Actions/Payment/FetchPaymentMethodsAction')
  route.get('/create-setup-intent/{id}', 'Actions/Payment/CreateSetupIntentAction')
  route.delete('/delete-payment-method/{id}', 'Actions/Payment/DeleteDefaultPaymentAction')
  route.put('/update-default-payment-method/{id}', 'Actions/Payment/UpdateDefaultPaymentMethodAction')
  route.post('/set-default-payment-method/{id}', 'Actions/Payment/SetDefaultPaymentAction')
  route.post('/user-default-payment-method/{id}', 'Actions/Payment/SetUserDefaultPaymentAction')
  route.post('/payment-method/{id}', 'Actions/Payment/StorePaymentMethodAction')
  route.post('/create-payment-intent/{id}', 'Actions/Payment/CreatePaymentIntentAction')
  route.post('/create-subscription/{id}', 'Actions/Payment/CreateSubscriptionAction')
  route.post('/update-subscription/{id}', 'Actions/Payment/UpdateSubscriptionAction')
  route.post('/cancel-subscription/{id}', 'Actions/Payment/CancelSubscriptionAction')
  route.post('/create-invoice-subscription/{id}', 'Actions/Payment/CreateInvoiceSubscription')
  route.patch('/update-customer/{id}', 'Actions/Payment/UpdateCustomerAction')
  route.post('/checkout/{id}', 'Actions/Payment/CreateCheckoutAction')

  route.get('/fetch-product/{id}', 'Actions/Payment/FetchProductAction')

  route.post('/store-transaction/{id}', 'Actions/Payment/StoreTransactionAction')
})

route.group({ prefix: '/commerce' }, async () => {
  // Print Devices
  route.get('/print-devices', 'Actions/Commerce/PrintDeviceIndexOrmAction')
  route.post('/print-devices', 'Actions/Commerce/PrintDeviceStoreOrmAction')
  route.get('/print-devices/{id}', 'Actions/Commerce/PrintDeviceShowOrmAction')
  route.patch('/print-devices/{id}', 'Actions/Commerce/PrintDeviceUpdateOrmAction')
  route.delete('/print-devices/{id}', 'Actions/Commerce/PrintDeviceDestroyOrmAction')

  // Product Categories
  route.get('/product-categories', 'Actions/Commerce/CategoryIndexOrmAction')
  route.post('/product-categories', 'Actions/Commerce/CategoryStoreOrmAction')
  route.get('/product-categories/{id}', 'Actions/Commerce/CategoryShowOrmAction')
  route.patch('/product-categories/{id}', 'Actions/Commerce/CategoryUpdateOrmAction')
  route.delete('/product-categories/{id}', 'Actions/Commerce/CategoryDestroyOrmAction')

  // Payments
  route.get('/payments', 'Actions/Commerce/PaymentIndexOrmAction')
  route.post('/payments', 'Actions/Commerce/PaymentStoreOrmAction')
  route.get('/payments/{id}', 'Actions/Commerce/PaymentShowOrmAction')
  route.get('/payments/stats', 'Actions/Commerce/PaymentFetchStatsAction')
  route.get('/payments/monthly-trends', 'Actions/Commerce/PaymentMonthlyTrendsAction')

  // Drivers
  route.get('/drivers', 'Actions/Commerce/DriverIndexOrmAction')
  route.post('/drivers', 'Actions/Commerce/DriverStoreOrmAction')
  route.get('/drivers/{id}', 'Actions/Commerce/DriverShowOrmAction')
  route.patch('/drivers/{id}', 'Actions/Commerce/DriverUpdateOrmAction')
  route.delete('/drivers/{id}', 'Actions/Commerce/DriverDestroyOrmAction')

  // Waitlist Products
  route.get('/waitlist-products', 'Actions/Commerce/WaitlistProductIndexOrmAction')
  route.post('/waitlist-products', 'Actions/Commerce/WaitlistProductStoreOrmAction')
  route.get('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductShowOrmAction')
  route.patch('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductUpdateOrmAction')
  route.delete('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductDestroyOrmAction')
  route.get('/waitlist-products/analytics', 'Actions/Commerce/WaitlistProductAnalyticsAction')
  route.get('/waitlist-products/status-stats', 'Actions/Commerce/WaitlistProductStatusAction')
  route.get('/waitlist-products/quantity-distribution', 'Actions/Commerce/WaitlistProductQuantityDistributionAction')
  route.get('/waitlist-products/time-series', 'Actions/Commerce/WaitlistProductTimeSeriesAction')

  // Digital Deliveries
  route.get('/digital-deliveries', 'Actions/Commerce/DigitalDeliveryIndexOrmAction')
  route.post('/digital-deliveries', 'Actions/Commerce/DigitalDeliveryStoreOrmAction')
  route.get('/digital-deliveries/{id}', 'Actions/Commerce/DigitalDeliveryShowOrmAction')
  route.patch('/digital-deliveries/{id}', 'Actions/Commerce/DigitalDeliveryUpdateOrmAction')
  route.delete('/digital-deliveries/{id}', 'Actions/Commerce/DigitalDeliveryDestroyOrmAction')

  // Product Manufacturers
  route.get('/product-manufacturers', 'Actions/Commerce/ManufacturerIndexOrmAction')
  route.post('/product-manufacturers', 'Actions/Commerce/ManufacturerStoreOrmAction')
  route.get('/product-manufacturers/{id}', 'Actions/Commerce/ManufacturerShowOrmAction')

  // Shipping Zones
  route.get('/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneIndexOrmAction')
  route.post('/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneStoreOrmAction')
  route.get('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneShowOrmAction')
  route.patch('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneUpdateOrmAction')
  route.delete('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneDestroyOrmAction')

  // Customers
  route.get('/customers', 'Actions/Commerce/CustomerIndexAction')
  route.post('/customers', 'Actions/Commerce/CustomerStoreAction')
  route.get('/customers/{id}', 'Actions/Commerce/CustomerShowAction')
  route.patch('/customers/{id}', 'Actions/Commerce/CustomerUpdateAction')
  route.delete('/customers/{id}', 'Actions/Commerce/CustomerDestroyAction')

  // Print Logs
  route.get('/print-logs', 'Actions/Commerce/ReceiptIndexAction')
  route.post('/print-logs', 'Actions/Commerce/ReceiptStoreAction')
  route.get('/print-logs/{id}', 'Actions/Commerce/ReceiptShowAction')
  route.patch('/print-logs/{id}', 'Actions/Commerce/ReceiptUpdateAction')
  route.delete('/print-logs/{id}', 'Actions/Commerce/ReceiptDestroyAction')

  // Product Variants
  route.get('/product-variants', 'Actions/Commerce/Products/ProductVariantIndexAction')
  route.post('/product-variants', 'Actions/Commerce/ProductVariantStoreAction')
  route.get('/product-variants/{id}', 'Actions/Commerce/ProductVariantShowAction')
  route.patch('/product-variants/{id}', 'Actions/Commerce/ProductVariantUpdateAction')
  route.delete('/product-variants/{id}', 'Actions/Commerce/ProductVariantDestroyAction')

  // License Keys
  route.get('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyIndexOrmAction')
  route.post('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyStoreOrmAction')
  route.get('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyShowOrmAction')
  route.patch('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyUpdateOrmAction')
  route.delete('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyDestroyOrmAction')

  // Waitlist Restaurants
  route.get('/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantIndexOrmAction')
  route.post('/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantStoreOrmAction')
  route.get('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantShowOrmAction')
  route.patch('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantUpdateOrmAction')
  route.delete('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantDestroyOrmAction')
  route.get('/waitlist-restaurants/dashboard', 'Actions/Commerce/WaitlistRestaurantDashboardAction')

  // Product Reviews
  route.get('/product-reviews', 'Actions/Commerce/Product/ReviewIndexOrmAction')
  route.post('/product-reviews', 'Actions/Commerce/Product/ReviewStoreOrmAction')
  route.get('/product-reviews/{id}', 'Actions/Commerce/Product/ReviewShowOrmAction')

  // Product Units
  route.get('/product-units', 'Actions/Commerce/Product/UnitIndexOrmAction')
  route.post('/product-units', 'Actions/Commerce/Product/UnitStoreOrmAction')
  route.get('/product-units/{id}', 'Actions/Commerce/Product/UnitShowOrmAction')

  // Gift Cards
  route.get('/gift-cards', 'Actions/Commerce/GiftCardIndexOrmAction')
  route.post('/gift-cards', 'Actions/Commerce/GiftCardStoreOrmAction')
  route.get('/gift-cards/{id}', 'Actions/Commerce/GiftCardShowOrmAction')
  route.get('/gift-cards/stats', 'Actions/Commerce/GiftCardStatsAction')
  route.patch('/gift-cards/{id}/balance', 'Actions/Commerce/GiftCardUpdateBalanceAction')

  // Orders
  route.get('/orders', 'Actions/Commerce/OrderIndexOrmAction')
  route.post('/orders', 'Actions/Commerce/OrderStoreOrmAction')
  route.get('/orders/{id}', 'Actions/Commerce/OrderShowOrmAction')
  route.get('/orders/export', 'Actions/Commerce/OrderExportAction')

  // Coupons
  route.get('/coupons', 'Actions/Commerce/CouponIndexOrmAction')
  route.post('/coupons', 'Actions/Commerce/CouponStoreOrmAction')
  route.get('/coupons/{id}', 'Actions/Commerce/CouponShowOrmAction')

  // Tax Rates
  route.get('/tax-rates', 'Actions/Commerce/TaxRateIndexOrmAction')
  route.post('/tax-rates', 'Actions/Commerce/TaxRateStoreOrmAction')
  route.get('/tax-rates/{id}', 'Actions/Commerce/TaxRateShowOrmAction')
  route.patch('/tax-rates/{id}', 'Actions/Commerce/TaxRateUpdateOrmAction')
  route.delete('/tax-rates/{id}', 'Actions/Commerce/TaxRateDestroyOrmAction')

  // Transactions
  route.get('/transactions', 'Actions/Commerce/TransactionIndexOrmAction')
  route.post('/transactions', 'Actions/Commerce/TransactionStoreOrmAction')
  route.get('/transactions/{id}', 'Actions/Commerce/TransactionShowOrmAction')

  // Loyalty Points
  route.get('/loyalty-points', 'Actions/Commerce/LoyaltyPointIndexOrmAction')
  route.post('/loyalty-points', 'Actions/Commerce/LoyaltyPointStoreOrmAction')
  route.get('/loyalty-points/{id}', 'Actions/Commerce/LoyaltyPointShowOrmAction')

  // Product Items
  route.get('/product-items', 'Actions/Commerce/Product/ItemIndexOrmAction')
  route.post('/product-items', 'Actions/Commerce/Product/ItemStoreOrmAction')
  route.get('/product-items/{id}', 'Actions/Commerce/Product/ItemShowOrmAction')

  // Loyalty Rewards
  route.get('/loyalty-rewards', 'Actions/Commerce/LoyaltyRewardIndexOrmAction')
  route.post('/loyalty-rewards', 'Actions/Commerce/LoyaltyRewardStoreOrmAction')
  route.get('/loyalty-rewards/{id}', 'Actions/Commerce/LoyaltyRewardShowOrmAction')

  // Shipping Methods
  route.get('/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodIndexOrmAction')
  route.post('/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodStoreOrmAction')
  route.get('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodShowOrmAction')
  route.patch('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodUpdateOrmAction')
  route.delete('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodDestroyOrmAction')

  // Shipping Rates
  route.get('/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateIndexOrmAction')
  route.post('/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateStoreOrmAction')
  route.get('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateShowOrmAction')
  route.patch('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateUpdateOrmAction')
  route.delete('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateDestroyOrmAction')

  // Delivery Routes
  route.get('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteIndexOrmAction')
  route.post('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteStoreOrmAction')
  route.get('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteShowOrmAction')
  route.patch('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteUpdateOrmAction')
  route.delete('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteDestroyOrmAction')
})

route.group({ prefix: '/cms' }, async () => {
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.post('/posts', 'Actions/Cms/PostStoreAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.patch('/posts/{id}', 'Actions/Cms/PostUpdateAction')
  route.delete('/posts/{id}', 'Actions/Cms/PostDestroyAction')

  // Pages
  route.get('/pages', 'Actions/Cms/PageIndexAction')
  route.post('/pages', 'Actions/Cms/PageStoreAction')
  route.get('/pages/{id}', 'Actions/Cms/PageShowAction')
  route.patch('/pages/{id}', 'Actions/Cms/PageUpdateAction')
  route.delete('/pages/{id}', 'Actions/Cms/PageDestroyAction')

  // Post Categories
  route.get('/categorizables', 'Actions/Cms/CategorizableIndexAction')
  route.post('/categorizables', 'Actions/Cms/CategorizableStoreAction')
  route.get('/categorizables/{id}', 'Actions/Cms/CategorizableShowAction')
  route.patch('/categorizables/{id}', 'Actions/Cms/CategorizableUpdateAction')
  route.delete('/categorizables/{id}', 'Actions/Cms/CategorizableDestroyAction')

  // Post Tags
  route.get('/taggables', 'Actions/Cms/TaggableIndexAction')
  route.post('/taggables', 'Actions/Cms/TaggableStoreAction')
  route.get('/taggables/{id}', 'Actions/Cms/TaggableShowAction')
  route.patch('/taggables/{id}', 'Actions/Cms/TaggableUpdateAction')
  route.delete('/taggables/{id}', 'Actions/Cms/TaggableDestroyAction')
})

route.group({ prefix: '/queues' }, async () => {
  route.get('/', 'Actions/Queue/FetchQueuesAction')
})

route.group({ prefix: '/realtime' }, async () => {
  route.get('/websockets', 'Actions/Realtime/FetchWebsocketsAction')
})

route.post('/password/send-password-reset-email', 'Actions/Password/SendPasswordResetEmailAction')
route.post('/password/reset', 'Actions/Password/PasswordResetAction')

// route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// route.action('Dashboard/GetProjects')
// route.action('Dashboard/Settings/UpdateAiConfig')
// route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`

// Query Dashboard routes
route.group({ prefix: '/queries' }, async () => {
  route.get('/stats', 'Controllers/QueryController@getStats')
  route.get('/recent', 'Controllers/QueryController@getRecentQueries')
  route.get('/slow', 'Controllers/QueryController@getSlowQueries')
  route.get('/:id', 'Controllers/QueryController@getQuery')
  route.get('/timeline', 'Controllers/QueryController@getQueryTimeline')
  route.get('/frequent', 'Controllers/QueryController@getFrequentQueries')
  route.post('/prune', 'Controllers/QueryController@pruneQueryLogs')
})

route.get('/me', 'Actions/Auth/AuthUserAction').middleware('auth')
