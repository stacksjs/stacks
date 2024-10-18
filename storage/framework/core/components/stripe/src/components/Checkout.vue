<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
    <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-xl"> <!-- Wider container -->
      <h1 class="text-3xl font-bold mb-4 text-center">Checkout</h1> <!-- Increased font size -->
      <div class="mb-6">
        <h2 class="text-2xl font-semibold mb-2">{{ product?.name }}</h2>
        <img :src="product?.images" alt="Product Image" class="w-full h-60 object-cover rounded-md mb-4" /> <!-- Increased image height -->
        <p class="text-gray-700 mb-2">{{ product?.description }}</p>
        <span class="text-lg font-semibold">${{ (product?.price / 100).toFixed(2) }}</span>
      </div>

      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-2">Payment Information</h3>
        <div ref="cardElement" class="border rounded-md p-3 bg-gray-50"></div>
      </div>

      <button
        @click="handlePayment"
        class="w-full bg-blue-600 text-white font-semibold py-3 rounded-md hover:bg-blue-700 transition"
      >
        Pay Now
      </button>
      
      <p class="text-center text-gray-500 text-sm mt-4">Secure checkout with Stripe</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const product = ref({
  name: 'iPhone Pro Max',
  price: 99900, // Price in cents ($999.00)
  images: 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-pro-model-unselect-gallery-2-202409?wid=5120&hei=2880&fmt=webp&qlt=70&.v=aWs5czA5aDFXU0FlMGFGRlpYRXk2UWFRQXQ2R0JQTk5udUZxTkR3ZVlpTDUwMGlYMEhQSTVNdkRDMFExUU1KbTBoUVhuTWlrY2hIK090ZGZZbk9HeE1xUVVnSHY5eU9CcGxDMkFhalkvT0FmZ0ROUGFSR25aOE5EM2xONlRwa09mbW94YnYxc1YvNXZ4emJGL0IxNFp3&traceId=1'
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

const loading = ref(false)

const handleSubmit = () => {
  loading.value = true
  // Placeholder for future submission logic
  console.log('Payment submitted, but no backend logic yet.')
  loading.value = false
}
</script>

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