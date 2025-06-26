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
  route.get('/print-devices', 'Actions/Commerce/PrintDeviceIndexAction')
  route.post('/print-devices', 'Actions/Commerce/PrintDeviceStoreAction')
  route.get('/print-devices/{id}', 'Actions/Commerce/PrintDeviceShowAction')
  route.patch('/print-devices/{id}', 'Actions/Commerce/PrintDeviceUpdateAction')
  route.delete('/print-devices/{id}', 'Actions/Commerce/PrintDeviceDestroyAction')

  // Product Categories
  route.get('/product-categories', 'Actions/Commerce/Product/ProductCategoryIndexAction')
  route.post('/product-categories', 'Actions/Commerce/Product/ProductCategoryStoreAction')
  route.get('/product-categories/{id}', 'Actions/Commerce/Product/ProductCategoryShowAction')
  route.patch('/product-categories/{id}', 'Actions/Commerce/Product/ProductCategoryUpdateAction')
  route.delete('/product-categories/{id}', 'Actions/Commerce/Product/ProductCategoryDestroyAction')

  // Payments
  route.get('/payments', 'Actions/Commerce/PaymentIndexAction')
  route.post('/payments', 'Actions/Commerce/PaymentStoreAction')
  route.get('/payments/{id}', 'Actions/Commerce/PaymentShowAction')
  route.get('/payments/stats', 'Actions/Commerce/PaymentFetchStatsAction')
  route.get('/payments/monthly-trends', 'Actions/Commerce/PaymentMonthlyTrendsAction')

  // Drivers
  route.get('/drivers', 'Actions/Commerce/DriverIndexAction')
  route.post('/drivers', 'Actions/Commerce/DriverStoreAction')
  route.get('/drivers/{id}', 'Actions/Commerce/DriverShowAction')
  route.patch('/drivers/{id}', 'Actions/Commerce/DriverUpdateAction')
  route.delete('/drivers/{id}', 'Actions/Commerce/DriverDestroyAction')

  // Waitlist Products
  route.get('/waitlist-products', 'Actions/Commerce/WaitlistProductIndexAction')
  route.post('/waitlist-products', 'Actions/Commerce/WaitlistProductStoreAction')
  route.get('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductShowAction')
  route.patch('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductUpdateAction')
  route.delete('/waitlist-products/{id}', 'Actions/Commerce/WaitlistProductDestroyAction')
  route.get('/waitlist-products/analytics', 'Actions/Commerce/WaitlistProductAnalyticsAction')
  route.get('/waitlist-products/status-stats', 'Actions/Commerce/WaitlistProductStatusAction')
  route.get('/waitlist-products/quantity-distribution', 'Actions/Commerce/WaitlistProductQuantityDistributionAction')
  route.get('/waitlist-products/time-series', 'Actions/Commerce/WaitlistProductTimeSeriesAction')

  // Digital Deliveries
  route.get('/digital-deliveries', 'Actions/Commerce/Shipping/DigitalDeliveryIndexAction')
  route.post('/digital-deliveries', 'Actions/Commerce/Shipping/DigitalDeliveryStoreAction')
  route.get('/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryShowAction')
  route.patch('/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryUpdateAction')
  route.delete('/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryDestroyAction')

  // Product Manufacturers
  route.get('/product-manufacturers', 'Actions/Commerce/Product/ManufacturerIndexAction')
  route.post('/product-manufacturers', 'Actions/Commerce/Product/ManufacturerStoreAction')
  route.get('/product-manufacturers/{id}', 'Actions/Commerce/Product/ManufacturerShowAction')

  // Shipping Zones
  route.get('/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneIndexAction')
  route.post('/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneStoreAction')
  route.get('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneShowAction')
  route.patch('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneUpdateAction')
  route.delete('/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneDestroyAction')

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
  route.get('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyIndexAction')
  route.post('/license-keys', 'Actions/Commerce/Shipping/LicenseKeyStoreAction')
  route.get('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyShowAction')
  route.patch('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyUpdateAction')
  route.delete('/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyDestroyAction')

  // Waitlist Restaurants
  route.get('/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantIndexAction')
  route.post('/waitlist-restaurants', 'Actions/Commerce/WaitlistRestaurantStoreAction')
  route.get('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantShowAction')
  route.patch('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantUpdateAction')
  route.delete('/waitlist-restaurants/{id}', 'Actions/Commerce/WaitlistRestaurantDestroyAction')
  route.get('/waitlist-restaurants/dashboard', 'Actions/Commerce/WaitlistRestaurantDashboardAction')

  // Product Reviews
  route.get('/product-reviews', 'Actions/Commerce/Product/ReviewIndexAction')
  route.post('/product-reviews', 'Actions/Commerce/Product/ReviewStoreAction')
  route.get('/product-reviews/{id}', 'Actions/Commerce/Product/ReviewShowAction')

  // Product Units
  route.get('/product-units', 'Actions/Commerce/Product/UnitIndexAction')
  route.post('/product-units', 'Actions/Commerce/Product/UnitStoreAction')
  route.get('/product-units/{id}', 'Actions/Commerce/Product/UnitShowAction')

  // Gift Cards
  route.get('/gift-cards', 'Actions/Commerce/GiftCardIndexAction')
  route.post('/gift-cards', 'Actions/Commerce/GiftCardStoreAction')
  route.get('/gift-cards/{id}', 'Actions/Commerce/GiftCardShowAction')
  route.get('/gift-cards/stats', 'Actions/Commerce/GiftCardStatsAction')
  route.patch('/gift-cards/{id}/balance', 'Actions/Commerce/GiftCardUpdateBalanceAction')

  // Orders
  route.get('/orders', 'Actions/Commerce/OrderIndexAction')
  route.post('/orders', 'Actions/Commerce/OrderStoreAction')
  route.patch('/orders/{id}', 'Actions/Commerce/OrderUpdateAction')
  route.delete('/orders/{id}', 'Actions/Commerce/OrderDestroyAction')
  route.get('/orders/{id}', 'Actions/Commerce/OrderShowAction')
  route.get('/orders/export', 'Actions/Commerce/OrderExportAction')

  // Coupons
  route.get('/coupons', 'Actions/Commerce/CouponIndexAction')
  route.post('/coupons', 'Actions/Commerce/CouponStoreAction')
  route.get('/coupons/{id}', 'Actions/Commerce/CouponShowAction')
  route.patch('/coupons/{id}', 'Actions/Commerce/CouponUpdateAction')
  route.delete('/coupons/{id}', 'Actions/Commerce/CouponDestroyAction')

  // Tax Rates
  route.get('/tax-rates', 'Actions/Commerce/TaxRateIndexAction')
  route.post('/tax-rates', 'Actions/Commerce/TaxRateStoreAction')
  route.get('/tax-rates/{id}', 'Actions/Commerce/TaxRateShowAction')
  route.patch('/tax-rates/{id}', 'Actions/Commerce/TaxRateUpdateAction')
  route.delete('/tax-rates/{id}', 'Actions/Commerce/TaxRateDestroyAction')

  // Transactions
  route.get('/transactions', 'Actions/Commerce/TransactionIndexAction')
  route.post('/transactions', 'Actions/Commerce/TransactionStoreAction')
  route.get('/transactions/{id}', 'Actions/Commerce/TransactionShowAction')

  // Loyalty Points
  route.get('/loyalty-points', 'Actions/Commerce/LoyaltyPointIndexAction')
  route.post('/loyalty-points', 'Actions/Commerce/LoyaltyPointStoreAction')
  route.get('/loyalty-points/{id}', 'Actions/Commerce/LoyaltyPointShowAction')

  // Product Items
  route.get('/products', 'Actions/Commerce/Product/ProductIndexAction')
  route.post('/products', 'Actions/Commerce/Product/ProductStoreAction')
  route.get('/products/{id}', 'Actions/Commerce/Product/ProductShowAction')

  // Loyalty Rewards
  route.get('/loyalty-rewards', 'Actions/Commerce/LoyaltyRewardIndexAction')
  route.post('/loyalty-rewards', 'Actions/Commerce/LoyaltyRewardStoreAction')
  route.get('/loyalty-rewards/{id}', 'Actions/Commerce/LoyaltyRewardShowAction')

  // Shipping Methods
  route.get('/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodIndexAction')
  route.post('/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodStoreAction')
  route.get('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodShowAction')
  route.patch('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodUpdateAction')
  route.delete('/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodDestroyAction')

  // Shipping Rates
  route.get('/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateIndexAction')
  route.post('/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateStoreAction')
  route.get('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateShowAction')
  route.patch('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateUpdateAction')
  route.delete('/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateDestroyAction')

  // Delivery Routes
  route.get('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteIndexAction')
  route.post('/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteStoreAction')
  route.get('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteShowAction')
  route.patch('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteUpdateAction')
  route.delete('/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteDestroyAction')
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
