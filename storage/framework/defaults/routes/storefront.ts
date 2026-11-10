import { route } from '@stacksjs/router'

/**
 * The storefront: an anonymous cart, the multi-step checkout and buyer
 * reviews, which the default `cart`, `checkout` and `orders` pages post to.
 *
 * Its own bundle, riding on the `commerce` feature like `delivery` and
 * `payments`, so an app that has not run `./buddy commerce:install` neither
 * mounts these routes nor serves the pages behind them. It lived in
 * `dashboard.ts`, where it was mounted, and its pages served, in every app
 * with a dashboard.
 *
 * CSRF is skipped because the storefront uses progressive-enhancement HTML
 * forms (there is no JS to mint a token) and each cart is already gated by an
 * opaque, HttpOnly session cookie that cannot be guessed. Apps that want
 * classic CSRF on top can re-register the same routes in their `routes/api.ts`
 * without `.skipCsrf()`.
 */

route.get('/api/cart', 'Actions/Storefront/GetCartAction').skipCsrf()
route.post('/api/cart/add', 'Actions/Storefront/AddToCartAction').skipCsrf()
route.post('/api/cart/update', 'Actions/Storefront/UpdateCartItemAction').skipCsrf()
route.post('/api/checkout/contact', 'Actions/Storefront/CheckoutContactAction').skipCsrf()
route.post('/api/checkout/shipping', 'Actions/Storefront/CheckoutShippingAction').skipCsrf()
route.post('/api/checkout/place', 'Actions/Storefront/PlaceOrderAction').skipCsrf()

// Buyer-submitted product review. Tied to a shipped order via order_id + email
// match (the SubmitReviewAction verifies ownership and stamps
// is_verified_purchase=1). Stored as is_approved=0 for admin moderation through
// `/dashboard/commerce/reviews`.
route.post('/api/reviews/submit', 'Actions/Storefront/SubmitReviewAction').skipCsrf()
