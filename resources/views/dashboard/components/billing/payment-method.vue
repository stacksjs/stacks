<script setup lang="ts">
import { loadStripe, publishableKey } from '../../../../functions/billing/payments'

let elements
let stripe

const loading = ref(true)

async function addPaymentMethod() {
  const url = 'http://localhost:3008/stripe/create-setup-intent'

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  })

  const client: any = await response.json()
  const clientSecret = client.client_secret // Use the setup intent client secret here

  // Initialize Stripe with the publishable key
  stripe = await loadStripe(publishableKey)

  if (stripe) {
    // Create Stripe elements using the setup intent client secret
    elements = stripe.elements({ clientSecret })

    // Create the Payment Element (it will function for saving a payment method only)
    const paymentElement = elements.create('payment', {
      // Set display options for adding a payment method
      fields: { billingDetails: 'auto' }, // Display only necessary fields
    })

    // Mount the payment element to your form
    paymentElement.mount('#payment-element')

    // Optional: Create a link authentication element if you need it
    const linkAuthenticationElement = elements.create('linkAuthentication')
    linkAuthenticationElement.mount('#link-authentication-element')
  }

  loading.value = false
}
</script>

<template>
  
  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">

   
    <h2 class="text-lg text-gray-900 font-medium">
      Payment Info
    </h2>

    <div class="flex items-start pt-4 space-x-2">
      <!-- <div class="h-12 w-12">
              <img src="/images/logos/mastercard.svg" alt="Mastercard Logo">
            </div> -->

      <!-- <h2 class="text-xl text-gray-600">
              •••• •••• •••• ••••
            </h2> -->

      <h2 class="text-xl text-gray-600">
        No payment method added yet.
      </h2>
    </div>

    <div v-show="!loading">
      <form id="payment-form">
        <div id="link-authentication-element">
          <!-- Stripe.js injects the Link Authentication Element -->
        </div>
        <div id="payment-element">
          <!-- Stripe.js injects the Payment Element -->
        </div>
        <button id="submit" class="primary-button">
          <div id="spinner" class="spinner hidden" />
          <span id="button-text">Pay now</span>
        </button>
        <div id="payment-message" class="hidden" />
      </form>
    </div>

    

    <div class="mt-8 flex">
      <button
        type="button"
        class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
        @click="addPaymentMethod()"
      >
        Add Payment Method
      </button>
    </div>
  </div>
</template>

<style>
#payment-message {
  color: rgb(105, 115, 134);
  font-size: 16px;
  line-height: 20px;
  padding-top: 12px;
  text-align: center;
}

#payment-element {
  margin-bottom: 24px;
}

#payment-form {
  width: 30vw;
  min-width: 500px;
  align-self: center;
  border-radius: 7px;
  padding: 40px;
}
</style>
