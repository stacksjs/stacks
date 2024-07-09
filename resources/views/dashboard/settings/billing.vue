<script setup lang="ts">
import { loadStripe } from '@stripe/stripe-js'
import type { Stripe } from '@stripe/stripe-js'

let elements

const loading = ref(true)

// TODO: learn about subscriptions
async function initialize() {
  const stripe: Stripe = await loadStripe('')

  // const items = [{ id: 'stacks-monthly-sub' }]

  fetch.post('createPaymentIntent')

  // const response = await paymentIntent.create({
  //   amount: calculateOrderAmount(),
  //   currency: "usd",
  //   automatic_payment_methods: {
  //     enabled: true,
  //   },
  // })

  const clientSecret: string | null = response.client_secret

  elements = stripe.elements({
    clientSecret,
  })

  // const linkAuthenticationElement = elements.create("linkAuthentication");
  // linkAuthenticationElement.mount("#link-authentication-element");

  // linkAuthenticationElement.on('change', (event) => {
  //   emailAddress = event.value.email;
  // });

  const paymentElementOptions = {
    layout: 'tabs',
  }

  const paymentElement = elements.create('payment', paymentElementOptions)
  paymentElement.mount('#payment-element')

  loading.value = false
}

async function payPlan() {
  await initialize()
}

// function calculateOrderAmount() {
//   // Replace this constant with a calculation of the order's amount
//   // Calculate the order total on the server to prevent
//   // people from directly manipulating the amount on the client
//   return 2000
// }
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex space-x-4">
      <div v-show="!loading" class="bg-white shadow-md px-8 py-6 rounded-md w-2/3">
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
    </div>
  </div>

  <div class="px-4 sm:px-6 lg:px-8 pb-12">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base font-semibold leading-6 text-gray-900">
          Transaction History
        </h1>
        <p class="mt-2 text-sm text-gray-700">
          A list with all your Stacks-relating transactions.
        </p>
      </div>
    </div>

    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Transaction
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Date
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Amount
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Payment Method
                  </th>

                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-gray-200 bg-white">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    Dashboard Subscription <em class="italic">(monthly)</em>
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    30/07/2023
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    $20.00
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    •••• •••• •••• 0000
                  </td>

                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <a href="#" class="text-blue-600 hover:text-blue-900">View<span class="sr-only">, Transaction</span></a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white mt-16 px-8 py-6 w-2/3 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <div class="flex items-center">
        <img
          src="/logo.svg"
          alt=""
          class="w-12 h-12 rounded-md"
        >
        <h2 class="text-lg font-medium text-gray-900 ml-4">
          Stacks Dashboard
        </h2>
      </div>

      <div class="pt-8">
        <p class="text-gray-500">
          Switch your subscription to a different type, such as a monthly plan, annual plan, or student plan.
        </p>

        <p class="text-gray-700 pt-4 font-semibold text-sm">
          Next payment of $20 (yearly) occurs on August 30, 2023
        </p>
      </div>

      <div class="flex mt-8">
        <button
          type="button"
          class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Cancel Plan
        </button>

        <button
          type="button"
          class="rounded-md ml-4  bg-blue-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="payPlan()"
        >
          Change Plan
        </button>
      </div>
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
