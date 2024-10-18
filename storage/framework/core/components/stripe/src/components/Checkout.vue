<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const product = ref({
  name: 'iPhone Pro Max',
  price: 99900, // Price in cents ($999.00)
  images: 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-pro-model-unselect-gallery-2-202409?wid=5120&hei=2880&fmt=webp&qlt=70&.v=aWs5czA5aDFXU0FlMGFGRlpYRXk2UWFRQXQ2R0JQTk5udUZxTkR3ZVlpTDUwMGlYMEhQSTVNdkRDMFExUU1KbTBoUVhuTWlrY2hIK090ZGZZbk9HeE1xUVVnSHY5eU9CcGxDMkFhalkvT0FmZ0ROUGFSR25aOE5EM2xONlRwa09mbW94YnYxc1YvNXZ4emJGL0IxNFp3&traceId=1',
})

const stripe = Stripe('test') // Replace with your actual publishable key
const elements = stripe.elements()
const cardElement = ref(null)
let card

onMounted(() => {
  // Create an instance of the card Element and mount it
  card = elements.create('card')
  card.mount(cardElement.value)
})

onBeforeUnmount(() => {
  if (card) {
    card.unmount()
  }
})

// eslint-disable-next-line unused-imports/no-unused-vars
const loading = ref(false)

// function handleSubmit() {
//   loading.value = true
//   // Placeholder for future submission logic
//   console.log('Payment submitted, but no backend logic yet.')
//   loading.value = false
// }
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
    <div class="max-w-xl w-full rounded-lg bg-white p-6 shadow-lg">
      <!-- Wider container -->
      <h1 class="mb-4 text-center text-3xl font-bold">
        Checkout
      </h1> <!-- Increased font size -->
      <div class="mb-6">
        <h2 class="mb-2 text-2xl font-semibold">
          {{ product?.name }}
        </h2>
        <img :src="product?.images" alt="Product Image" class="mb-4 h-60 w-full rounded-md object-cover"> <!-- Increased image height -->
        <p class="mb-2 text-gray-700">
          {{ product?.description }}
        </p>
        <span class="text-lg font-semibold">${{ (product?.price / 100).toFixed(2) }}</span>
      </div>

      <div class="mb-6">
        <h3 class="mb-2 text-lg font-semibold">
          Payment Information
        </h3>
        <div ref="cardElement" class="border rounded-md bg-gray-50 p-3" />
      </div>

      <button
        class="w-full rounded-md bg-blue-600 py-3 text-white font-semibold transition hover:bg-blue-700"
        @click="handlePayment"
      >
        Pay Now
      </button>

      <p class="mt-4 text-center text-sm text-gray-500">
        Secure checkout with Stripe
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Style for Stripe Elements */
.StripeElement {
  box-sizing: border-box; /* Ensure padding is included in width */
  height: 40px; /* Height of the input */
  padding: 10px; /* Padding inside input */
  border: 1px solid #ccc; /* Light border */
  border-radius: 4px; /* Rounded corners */
  background-color: #f9f9f9; /* Light background */
  font-size: 16px; /* Font size */
  transition: border-color 0.2s ease; /* Smooth border transition */
}

.StripeElement--focus {
  border-color: #007bff; /* Blue border on focus */
}

.StripeElement--invalid {
  border-color: #fa755a; /* Red border for invalid input */
}

.StripeElement--webkit-autofill {
  background-color: #f9f9f9 !important; /* Autofill background color */
}
</style>
