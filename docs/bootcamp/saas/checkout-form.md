# Checkout Form

The Checkout Form module provides UI components and functionality for building shopping carts, checkout flows, and payment forms. This guide covers cart management, checkout UI components, and integration with payment processing.

## Getting Started

Import the checkout and cart functionality:

```ts
import { manageCheckout } from '@stacksjs/payments'
import { Cart, CartItem } from '@stacksjs/commerce'
```

## Cart Management

### Creating a Cart

```ts
async function createCart(userId?: number): Promise<CartModel> {
  const cart = await Cart.create({
    user_id: userId || null,
    session_id: userId ? null : generateSessionId(),
    status: 'active',
    currency: 'USD',
    created_at: new Date().toISOString(),
  })

  return cart
}

function generateSessionId(): string {
  return `sess_${randomUUIDv7()}`
}
```

### Adding Items to Cart

```ts
async function addToCart(
  cartId: number,
  productId: number,
  quantity: number = 1,
  options?: Record<string, any>
): Promise<CartItemModel> {
  // Check if item already exists in cart
  const existingItem = await CartItem
    .where('cart_id', '=', cartId)
    .where('product_id', '=', productId)
    .first()

  if (existingItem) {
    // Update quantity
    await existingItem.update({
      quantity: existingItem.quantity + quantity,
    })
    return existingItem
  }

  // Get product details
  const product = await Product.find(productId)

  if (!product) throw new Error('Product not found')

  // Add new item
  const cartItem = await CartItem.create({
    cart_id: cartId,
    product_id: productId,
    quantity,
    unit_price: product.price,
    options: JSON.stringify(options || {}),
  })

  // Update cart totals
  await updateCartTotals(cartId)

  return cartItem
}
```

### Updating Cart Items

```ts
async function updateCartItem(
  cartItemId: number,
  quantity: number
): Promise<CartItemModel> {
  const cartItem = await CartItem.find(cartItemId)

  if (!cartItem) throw new Error('Cart item not found')

  if (quantity <= 0) {
    await cartItem.delete()
  } else {
    await cartItem.update({ quantity })
  }

  await updateCartTotals(cartItem.cart_id)

  return cartItem
}
```

### Removing Items from Cart

```ts
async function removeFromCart(cartItemId: number): Promise<void> {
  const cartItem = await CartItem.find(cartItemId)

  if (!cartItem) throw new Error('Cart item not found')

  const cartId = cartItem.cart_id

  await cartItem.delete()
  await updateCartTotals(cartId)
}
```

### Calculating Cart Totals

```ts
async function updateCartTotals(cartId: number): Promise<void> {
  const items = await CartItem
    .where('cart_id', '=', cartId)
    .get()

  const subtotal = items.reduce((sum, item) => {
    return sum + (item.unit_price * item.quantity)
  }, 0)

  // Apply discounts if any
  const cart = await Cart.find(cartId)
  let discount = 0

  if (cart?.coupon_code) {
    discount = await calculateDiscount(cart.coupon_code, subtotal)
  }

  // Calculate tax
  const taxRate = 0.0825 // 8.25% - adjust based on location
  const tax = (subtotal - discount) * taxRate

  const total = subtotal - discount + tax

  await Cart.where('id', '=', cartId).update({
    subtotal,
    discount,
    tax,
    total,
  })
}
```

### Applying Coupon Codes

```ts
async function applyCoupon(
  cartId: number,
  couponCode: string
): Promise<{ success: boolean, message: string }> {
  const coupon = await Coupon
    .where('code', '=', couponCode)
    .where('status', '=', 'active')
    .first()

  if (!coupon) {
    return { success: false, message: 'Invalid coupon code' }
  }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { success: false, message: 'Coupon has expired' }
  }

  // Check usage limit
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { success: false, message: 'Coupon usage limit reached' }
  }

  await Cart.where('id', '=', cartId).update({
    coupon_code: couponCode,
    coupon_id: coupon.id,
  })

  await updateCartTotals(cartId)

  return { success: true, message: 'Coupon applied successfully' }
}
```

## Checkout Components

### Cart Summary Component

```vue
<!-- components/CartSummary.vue -->
<template>
  <div class="cart-summary">
    <h2>Order Summary</h2>

    <div class="cart-items">
      <div v-for="item in cartItems" :key="item.id" class="cart-item">
        <img :src="item.product.image" :alt="item.product.name" />
        <div class="item-details">
          <h3>{{ item.product.name }}</h3>
          <p class="price">${{ formatPrice(item.unit_price) }}</p>
        </div>
        <div class="quantity-controls">
          <button @click="decreaseQuantity(item)">-</button>
          <span>{{ item.quantity }}</span>
          <button @click="increaseQuantity(item)">+</button>
        </div>
        <button class="remove-btn" @click="removeItem(item)">
          Remove
        </button>
      </div>
    </div>

    <div class="cart-totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${{ formatPrice(cart.subtotal) }}</span>
      </div>
      <div v-if="cart.discount > 0" class="total-row discount">
        <span>Discount</span>
        <span>-${{ formatPrice(cart.discount) }}</span>
      </div>
      <div class="total-row">
        <span>Tax</span>
        <span>${{ formatPrice(cart.tax) }}</span>
      </div>
      <div class="total-row total">
        <span>Total</span>
        <span>${{ formatPrice(cart.total) }}</span>
      </div>
    </div>

    <div class="coupon-form">
      <input
        v-model="couponCode"
        type="text"
        placeholder="Enter coupon code"
      />
      <button @click="applyCoupon">Apply</button>
    </div>

    <button class="checkout-btn" @click="proceedToCheckout">
      Proceed to Checkout
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const cart = ref({})
const cartItems = ref([])
const couponCode = ref('')

async function loadCart() {
  const response = await fetch('/api/cart')
  const data = await response.json()
  cart.value = data.cart
  cartItems.value = data.items
}

async function increaseQuantity(item) {
  await fetch(`/api/cart/items/${item.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity: item.quantity + 1 }),
  })
  await loadCart()
}

async function decreaseQuantity(item) {
  if (item.quantity <= 1) {
    await removeItem(item)
  } else {
    await fetch(`/api/cart/items/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: item.quantity - 1 }),
    })
    await loadCart()
  }
}

async function removeItem(item) {
  await fetch(`/api/cart/items/${item.id}`, { method: 'DELETE' })
  await loadCart()
}

async function applyCoupon() {
  await fetch('/api/cart/coupon', {
    method: 'POST',
    body: JSON.stringify({ code: couponCode.value }),
  })
  await loadCart()
}

function proceedToCheckout() {
  window.location.href = '/checkout'
}

function formatPrice(cents) {
  return (cents / 100).toFixed(2)
}

onMounted(loadCart)
</script>
```

### Checkout Form Component

```vue
<!-- components/CheckoutForm.vue -->
<template>
  <form @submit.prevent="submitCheckout" class="checkout-form">
    <!-- Contact Information -->
    <section class="checkout-section">
      <h2>Contact Information</h2>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          required
        />
      </div>
    </section>

    <!-- Shipping Address -->
    <section class="checkout-section">
      <h2>Shipping Address</h2>
      <div class="form-row">
        <div class="form-group">
          <label for="firstName">First Name</label>
          <input id="firstName" v-model="form.firstName" required />
        </div>
        <div class="form-group">
          <label for="lastName">Last Name</label>
          <input id="lastName" v-model="form.lastName" required />
        </div>
      </div>
      <div class="form-group">
        <label for="address">Address</label>
        <input id="address" v-model="form.address" required />
      </div>
      <div class="form-group">
        <label for="apartment">Apartment, suite, etc. (optional)</label>
        <input id="apartment" v-model="form.apartment" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="city">City</label>
          <input id="city" v-model="form.city" required />
        </div>
        <div class="form-group">
          <label for="state">State</label>
          <select id="state" v-model="form.state" required>
            <option value="">Select state</option>
            <option v-for="state in states" :key="state.code" :value="state.code">
              {{ state.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="zipCode">ZIP Code</label>
          <input id="zipCode" v-model="form.zipCode" required />
        </div>
      </div>
    </section>

    <!-- Payment -->
    <section class="checkout-section">
      <h2>Payment</h2>
      <div id="card-element" ref="cardElement"></div>
      <div v-if="cardError" class="error-message">{{ cardError }}</div>
    </section>

    <!-- Order Summary -->
    <section class="checkout-section order-summary">
      <h2>Order Summary</h2>
      <div class="summary-items">
        <div v-for="item in cartItems" :key="item.id" class="summary-item">
          <span>{{ item.product.name }} x {{ item.quantity }}</span>
          <span>${{ formatPrice(item.unit_price * item.quantity) }}</span>
        </div>
      </div>
      <div class="summary-totals">
        <div class="summary-row">
          <span>Subtotal</span>
          <span>${{ formatPrice(cart.subtotal) }}</span>
        </div>
        <div class="summary-row">
          <span>Shipping</span>
          <span>${{ formatPrice(shippingCost) }}</span>
        </div>
        <div class="summary-row">
          <span>Tax</span>
          <span>${{ formatPrice(cart.tax) }}</span>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <span>${{ formatPrice(cart.total + shippingCost) }}</span>
        </div>
      </div>
    </section>

    <button type="submit" :disabled="processing" class="submit-btn">
      {{ processing ? 'Processing...' : `Pay $${formatPrice(cart.total + shippingCost)}` }}
    </button>
  </form>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { loadStripe } from '@stripe/stripe-js'

const stripe = ref(null)
const elements = ref(null)
const cardElement = ref(null)
const cardError = ref('')
const processing = ref(false)

const form = ref({
  email: '',
  firstName: '',
  lastName: '',
  address: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
})

const cart = ref({})
const cartItems = ref([])
const shippingCost = ref(0)

async function initStripe() {
  stripe.value = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  elements.value = stripe.value.elements()

  const card = elements.value.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': { color: '#aab7c4' },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  })

  card.mount('#card-element')
  card.on('change', (event) => {
    cardError.value = event.error ? event.error.message : ''
  })

  cardElement.value = card
}

async function submitCheckout() {
  if (processing.value) return
  processing.value = true

  try {
    // Create payment intent
    const response = await fetch('/api/checkout/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart_id: cart.value.id,
        shipping: {
          name: `${form.value.firstName} ${form.value.lastName}`,
          address: {
            line1: form.value.address,
            line2: form.value.apartment,
            city: form.value.city,
            state: form.value.state,
            postal_code: form.value.zipCode,
            country: 'US',
          },
        },
        email: form.value.email,
      }),
    })

    const { clientSecret, orderId } = await response.json()

    // Confirm payment
    const { error, paymentIntent } = await stripe.value.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement.value,
          billing_details: {
            name: `${form.value.firstName} ${form.value.lastName}`,
            email: form.value.email,
          },
        },
      }
    )

    if (error) {
      cardError.value = error.message
    } else if (paymentIntent.status === 'succeeded') {
      // Redirect to success page
      window.location.href = `/order/success?order_id=${orderId}`
    }
  } catch (error) {
    cardError.value = 'An error occurred. Please try again.'
  } finally {
    processing.value = false
  }
}

function formatPrice(cents) {
  return (cents / 100).toFixed(2)
}

onMounted(async () => {
  await initStripe()
  // Load cart data...
})
</script>
```

## Checkout Session API

### Create Payment Intent

```ts
// routes/api.ts
router.post('/api/checkout/create-payment-intent', async (request) => {
  const { cart_id, shipping, email } = await request.json()

  const cart = await Cart.with(['items', 'items.product']).find(cart_id)

  if (!cart) {
    return Response.json({ error: 'Cart not found' }, { status: 404 })
  }

  // Create order
  const order = await Order.create({
    user_id: request.user?.id,
    cart_id: cart.id,
    email,
    shipping_address: JSON.stringify(shipping.address),
    shipping_name: shipping.name,
    subtotal: cart.subtotal,
    tax: cart.tax,
    discount: cart.discount,
    shipping_cost: calculateShipping(shipping.address),
    total: cart.total + calculateShipping(shipping.address),
    status: 'pending',
  })

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.total,
    currency: 'usd',
    metadata: {
      order_id: order.id.toString(),
      cart_id: cart.id.toString(),
    },
  })

  return Response.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
  })
})
```

### Hosted Checkout Session

```ts
async function createCheckoutSession(
  cartId: number,
  userId: number,
  successUrl: string,
  cancelUrl: string
) {
  const cart = await Cart.with(['items', 'items.product']).find(cartId)

  if (!cart) throw new Error('Cart not found')

  const lineItems = cart.items.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product.name,
        images: [item.product.image],
      },
      unit_amount: item.unit_price,
    },
    quantity: item.quantity,
  }))

  const user = await User.find(userId)

  const session = await manageCheckout.create(user, {
    mode: 'payment',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      cart_id: cartId.toString(),
      user_id: userId.toString(),
    },
  })

  return session
}
```

## API Endpoints

```
GET    /api/cart                      # Get current cart
POST   /api/cart/items                # Add item to cart
PATCH  /api/cart/items/{id}           # Update cart item
DELETE /api/cart/items/{id}           # Remove cart item
POST   /api/cart/coupon               # Apply coupon
DELETE /api/cart/coupon               # Remove coupon
POST   /api/checkout/create-payment-intent  # Create payment intent
POST   /api/checkout/session          # Create Stripe checkout session
```

### Example API Usage

```ts
// Add to cart
const response = await fetch('/api/cart/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product_id: 123,
    quantity: 2,
  }),
})

// Create checkout session
const response = await fetch('/api/checkout/session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    success_url: 'https://yourapp.com/success',
    cancel_url: 'https://yourapp.com/cart',
  }),
})
const { url } = await response.json()
window.location.href = url
```

## Error Handling

```ts
try {
  const result = await submitCheckout()
} catch (error) {
  if (error.type === 'card_error') {
    // Display card error to user
    showError(error.message)
  } else if (error.type === 'validation_error') {
    // Form validation error
    showValidationErrors(error.errors)
  } else {
    // Generic error
    showError('An error occurred. Please try again.')
  }
}
```

This documentation covers the essential checkout form and cart management functionality. Each component is designed for a smooth checkout experience with proper error handling and validation.
