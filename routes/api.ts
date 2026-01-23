import { response, route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://docs.stacksjs.com/routing
 */

route.get('/foo/bar/{id}', () => response.text('hello world, foo bar')) // $API_URL/hello/world
route.get('/', () => response.text('hello world')) // $API_URL
route.get('/hello/world', () => response.text('hello world, buddy')) // $API_URL/hello/world
route.get('/json', () => response.json({ message: 'Hello JSON!', status: 'ok', timestamp: Date.now() }))

// Email subscription endpoint
route.post('/api/email/subscribe', 'Actions/SubscriberEmailAction')
route.post('/login', 'Actions/Auth/LoginAction')
route.post('/register', 'Actions/Auth/RegisterAction')
route.get('/generate-registration-options', 'Actions/Auth/GenerateRegistrationAction')
route.post('/verify-registration', 'Actions/Auth/VerifyRegistrationAction')
route.get('/generate-authentication-options', 'Actions/Auth/GenerateAuthenticationAction')
route.get('/verify-authentication', 'Actions/Auth/VerifyAuthenticationAction')

// Token management routes
route.group({ prefix: '/auth' }, () => {
  // Public - refresh token (no auth middleware needed)
  route.post('/refresh', 'Actions/Auth/RefreshTokenAction')

  // Protected - requires authentication
  route.get('/tokens', 'Actions/Auth/ListTokensAction').middleware('auth')
  route.post('/token', 'Actions/Auth/CreateTokenAction').middleware('auth')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction').middleware('auth')
  route.get('/abilities', 'Actions/Auth/TestAbilitiesAction').middleware('auth')
})

route.get('/coming-soon', 'Controllers/ComingSoonController@index')

// route.email('/welcome')
route.health() // adds a GET `/health` route

// Test error page (development only)
route.get('/test-error', 'Actions/TestErrorAction') // Visit /test-error?type=database|validation|auth|notfound|generic
route.get('/install', 'Actions/InstallAction')
route.post('/ai/ask', 'Actions/AI/AskAction')
route.post('/ai/summary', 'Actions/AI/SummaryAction')

// Voide - Voice AI Code Assistant routes (Voice + Claude)
route.group({ prefix: '/voide' }, () => {
  route.get('/state', 'Actions/Buddy/BuddyStateAction')
  route.post('/repo', 'Actions/Buddy/BuddyRepoOpenAction')
  route.post('/repo/validate', 'Actions/Buddy/BuddyRepoValidateAction')
  route.post('/process', 'Actions/Buddy/BuddyProcessAction')
  route.post('/process/stream', 'Actions/Buddy/BuddyProcessStreamAction') // SSE streaming endpoint
  route.post('/commit', 'Actions/Buddy/BuddyCommitAction')
  route.post('/push', 'Actions/Buddy/BuddyPushAction')
  route.post('/cancel', 'Actions/Buddy/BuddyCancelAction')
  route.post('/browse', 'Actions/Buddy/BuddyBrowseAction')
  route.post('/title', 'Actions/Buddy/BuddyTitleAction') // Generate chat title from prompt
  route.get('/settings', 'Actions/Buddy/BuddySettingsAction')
  route.post('/settings', 'Actions/Buddy/BuddySettingsUpdateAction')
  route.post('/github/connect', 'Actions/Buddy/BuddyGitHubConnectAction')
  route.post('/github/disconnect', 'Actions/Buddy/BuddyGitHubDisconnectAction')
})  

route.group({ prefix: '/payments' }, () => {
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

route.group({ prefix: '/queues' }, () => {
  route.get('/', 'Actions/Queue/FetchQueuesAction')
})

route.group({ prefix: '/realtime' }, () => {
  route.get('/websockets', 'Actions/Realtime/FetchWebsocketsAction')
})

// Password Reset routes
route.group({ prefix: '/password' }, () => {
  route.post('/forgot', 'Actions/Password/SendPasswordResetEmailAction')
  route.post('/reset', 'Actions/Password/PasswordResetAction')
  route.post('/verify-token', 'Actions/Password/VerifyResetTokenAction')
})

// route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// route.action('Dashboard/GetProjects')
// route.action('Dashboard/Settings/UpdateAiConfig')
// route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`

// Query Dashboard routes
route.group({ prefix: '/queries' }, () => {
  route.get('/stats', 'Controllers/QueryController@getStats')
  route.get('/recent', 'Controllers/QueryController@getRecentQueries')
  route.get('/slow', 'Controllers/QueryController@getSlowQueries')
  route.get('/:id', 'Controllers/QueryController@getQuery')
  route.get('/timeline', 'Controllers/QueryController@getQueryTimeline')
  route.get('/frequent', 'Controllers/QueryController@getFrequentQueries')
  route.post('/prune', 'Controllers/QueryController@pruneQueryLogs')
})

// Dashboard routes
route.group({ prefix: '/dashboard' }, () => {
  route.get('/stats', 'Actions/Dashboard/DashboardStatsAction')
  route.get('/activity', 'Actions/Dashboard/DashboardActivityAction')
  route.get('/health', 'Actions/Dashboard/DashboardHealthAction')
})

// Direct test route without action resolution
route.get('/test/direct', () => response.json({ message: 'Direct route works!' }))

// File upload test route
route.post('/test/upload', 'Actions/UploadTestAction')

// Error Tracking / Monitoring routes
route.group({ prefix: '/monitoring' }, () => {
  // Errors
  route.get('/errors', 'Actions/Monitoring/ErrorIndexAction')
  route.get('/errors/stats', 'Actions/Monitoring/ErrorStatsAction')
  route.get('/errors/timeline', 'Actions/Monitoring/ErrorTimelineAction')
  route.get('/errors/group', 'Actions/Monitoring/ErrorGroupAction')
  route.get('/errors/{id}', 'Actions/Monitoring/ErrorShowAction')
  route.patch('/errors/resolve', 'Actions/Monitoring/ErrorResolveAction')
  route.patch('/errors/ignore', 'Actions/Monitoring/ErrorIgnoreAction')
  route.patch('/errors/unresolve', 'Actions/Monitoring/ErrorUnresolveAction')
  route.delete('/errors', 'Actions/Monitoring/ErrorDestroyAction')
})




// CMS / Blog routes
route.group({ prefix: '/cms' }, () => {
  // Posts - Full CRUD for blog posts
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.post('/posts', 'Actions/Cms/PostStoreAction')
  route.patch('/posts/{id}', 'Actions/Cms/PostUpdateAction')
  route.delete('/posts/{id}', 'Actions/Cms/PostDestroyAction')
  route.patch('/posts/{id}/views', 'Actions/Cms/PostViewsUpdateAction')

  // Authors
  route.get('/authors', 'Actions/Cms/AuthorIndexAction')
  route.get('/authors/{id}', 'Actions/Cms/AuthorShowAction')
  route.post('/authors', 'Actions/Cms/AuthorStoreAction')
  route.patch('/authors/{id}', 'Actions/Cms/AuthorUpdateAction')
  route.delete('/authors/{id}', 'Actions/Cms/AuthorDestroyAction')

  // Categories
  route.get('/categories', 'Actions/Cms/CategorizableIndexAction')
  route.get('/categories/{id}', 'Actions/Cms/CategorizableShowAction')
  route.post('/categories', 'Actions/Cms/CategorizableStoreAction')
  route.patch('/categories/{id}', 'Actions/Cms/CategorizableUpdateAction')
  route.delete('/categories/{id}', 'Actions/Cms/CategorizableDestroyAction')

  // Tags
  route.get('/tags', 'Actions/Cms/TaggableIndexAction')
  route.get('/tags/{id}', 'Actions/Cms/TaggableShowAction')
  route.post('/tags', 'Actions/Cms/TaggableStoreAction')
  route.patch('/tags/{id}', 'Actions/Cms/TaggableUpdateAction')
  route.delete('/tags/{id}', 'Actions/Cms/TaggableDestroyAction')

  // Comments
  route.get('/comments', 'Actions/Cms/CommentIndexAction')
  route.get('/comments/{id}', 'Actions/Cms/CommentShowAction')
  route.post('/comments', 'Actions/Cms/CommentStoreAction')
  route.patch('/comments/{id}', 'Actions/Cms/CommentUpdateAction')
  route.delete('/comments/{id}', 'Actions/Cms/CommentDestroyAction')

  // Pages
  route.get('/pages', 'Actions/Cms/PageIndexAction')
  route.post('/pages', 'Actions/Cms/PageStoreAction')
  route.patch('/pages/{id}', 'Actions/Cms/PageUpdateAction')
  route.delete('/pages/{id}', 'Actions/Cms/PageDestroyAction')
})

// Public Blog routes (for frontend consumption)
route.group({ prefix: '/blog' }, () => {
  route.get('/posts', 'Actions/Cms/PostIndexAction')
  route.get('/posts/{id}', 'Actions/Cms/PostShowAction')
  route.get('/categories', 'Actions/Cms/CategorizableIndexAction')
  route.get('/tags', 'Actions/Cms/TaggableIndexAction')
  route.get('/feed.xml', 'Actions/Cms/RssFeedAction')
  route.get('/sitemap.xml', 'Actions/Cms/SitemapAction')
})

// Authenticated user routes
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
})
