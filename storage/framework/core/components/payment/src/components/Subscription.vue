<script setup lang="ts">
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js'

import { onMounted, ref } from 'vue'

interface Products {
  name: string
  price: number
  images: string
}

interface Props {
  products: Products[]
  redirectUrl: string
  applePay?: boolean
  googlePay?: boolean
}

const props = defineProps<Props>()
const clientSecret = ref('')
let elements: StripeElements | null = null
let stripe: Stripe | null = null
const publicKey = ''

const products = props.products

onMounted(async () => {
  stripe = await loadStripe(publicKey)

  await createPaymentIntent()
  await loadElements() // Load both address and payment elements
})

async function createPaymentIntent() {
  const url = 'http://localhost:3008/stripe/create-subscription'

  const body = { amount: 99900, quantity: 1 }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const paymentIntent: any = await response.json()
  clientSecret.value = paymentIntent.client_secret
}

async function loadElements() {
  if (stripe) {
    const appearance = { /* appearance options */ }
    // const options = { mode: 'billing' }

    // Create the elements instance once
    elements = stripe.elements({ clientSecret: clientSecret.value, appearance })

    // Create and mount the address element
    // const addressElement = elements.create('address', options)
    // addressElement.mount('#address-element')

    // Create and mount the payment element
    const paymentElement = elements.create('payment')
    paymentElement.mount('#payment-element')
  }
}

async function handleSubmit() {
  if (stripe && elements) {
    // const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    await stripe.confirmPayment({ elements, redirect: 'if_required' })
  }
}
</script>

<template>
  <div class="bg-gray-50">
    <div class="mx-auto max-w-2xl px-4 pb-24 pt-16 lg:max-w-7xl lg:px-8 sm:px-6">
      <h2 class="sr-only">
        Checkout
      </h2>

      <form class="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
        <div>
          <div>
            <h2 class="text-lg text-gray-900 font-medium">
              Contact information
            </h2>

            <div class="mt-4">
              <label for="email-address" class="block text-sm text-gray-700 font-medium">Email address</label>
              <div class="mt-1">
                <input id="email-address" type="email" name="email-address" autocomplete="email" class="block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:border-indigo-500 sm:text-sm focus:ring-indigo-500">
              </div>
            </div>
          </div>

          <div class="mt-10 border-t border-gray-200 pt-10">
            <h2 class="text-lg text-gray-900 font-medium">
              Billing information
            </h2>

            <div id="address-element" class="mt-12" />
          </div>

          <!-- Payment -->
          <div class="mt-10 border-t border-gray-200 pt-10">
            <h2 class="text-lg text-gray-900 font-medium">
              Payment
            </h2>

            <fieldset class="mt-4">
              <legend class="sr-only">
                Payment type
              </legend>
              <div class="sm:flex sm:items-center space-y-4 sm:space-x-10 sm:space-y-0">
                <div class="flex items-center">
                  <input id="credit-card" name="payment-type" type="radio" checked class="form h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500">
                  <label for="credit-card" class="ml-3 block text-sm text-gray-700 font-medium">Credit card</label>
                </div>
              </div>
            </fieldset>

            <div class="mt-6">
              <div id="payment-element" class="border rounded-md bg-gray-50 p-3" />
            </div>
          </div>
        </div>

        <!-- Order summary -->
        <div class="mt-10 lg:mt-0">
          <h2 class="text-lg text-gray-900 font-medium">
            Order summary
          </h2>

          <div class="mt-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <h3 class="sr-only">
              Items in your cart
            </h3>
            <ul role="list" class="divide-y divide-gray-200">
              <li v-for="(product, index) in products" :key="index" class="flex px-4 py-6 sm:px-6">
                <div class="flex-shrink-0">
                  <img :src="product?.images" alt="Front of men&#039;s Basic Tee in black." class="w-50 rounded-md">
                </div>

                <div class="ml-6 flex flex-1 flex-col">
                  <div class="flex">
                    <div class="min-w-0 flex-1">
                      <h4 class="text-sm">
                        <a href="#" class="text-gray-700 font-medium hover:text-gray-800">{{ product?.name }}</a>
                      </h4>
                      <p class="mt-1 text-sm text-gray-500">
                        ..
                      </p>
                      <p class="mt-1 text-sm text-gray-500">
                        ..
                      </p>
                    </div>

                    <div class="ml-4 flow-root flex-shrink-0">
                      <button type="button" class="flex items-center justify-center bg-white p-2.5 text-gray-400 -m-2.5 hover:text-gray-500">
                        <span class="sr-only">Remove</span>
                        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                          <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="flex flex-1 items-end justify-between pt-2">
                    <p class="mt-1 text-sm text-gray-900 font-medium">
                      ${{ (product?.price / 100).toFixed(2) }}
                    </p>

                    <div class="ml-4">
                      <label for="quantity" class="sr-only">Quantity</label>
                      <select id="quantity" name="quantity" class="border border-gray-300 rounded-md text-left text-base text-gray-700 font-medium shadow-sm focus:border-indigo-500 sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="1">
                          1
                        </option>
                        <option value="2">
                          2
                        </option>
                        <option value="3">
                          3
                        </option>
                        <option value="4">
                          4
                        </option>
                        <option value="5">
                          5
                        </option>
                        <option value="6">
                          6
                        </option>
                        <option value="7">
                          7
                        </option>
                        <option value="8">
                          8
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
            <dl class="border-t border-gray-200 px-4 py-6 space-y-6 sm:px-6">
              <div class="flex items-center justify-between">
                <dt class="text-sm">
                  Subtotal
                </dt>
                <dd class="text-sm text-gray-900 font-medium">
                  $950.00
                </dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-sm">
                  Shipping
                </dt>
                <dd class="text-sm text-gray-900 font-medium">
                  $45.00
                </dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-sm">
                  Taxes
                </dt>
                <dd class="text-sm text-gray-900 font-medium">
                  $5.52
                </dd>
              </div>
              <div class="flex items-center justify-between border-t border-gray-200 pt-6">
                <dt class="text-base font-medium">
                  Total
                </dt>
                <dd class="text-base text-gray-900 font-medium">
                  $999.00
                </dd>
              </div>
            </dl>

            <div class="border-t border-gray-200 px-4 py-6 sm:px-6">
              <button type="button" class="w-full border border-transparent rounded-md bg-indigo-600 px-4 py-3 text-base text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-50" @click="handleSubmit">
                Confirm order
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
