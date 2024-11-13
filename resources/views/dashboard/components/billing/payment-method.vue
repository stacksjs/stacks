<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'

const stripeLoading = ref(true)
const showStripe = ref(false)

const { fetchSetupIntent, loadStripeElement, handleAddPaymentMethod } = useBillable()

async function loadWebElement() {
  const clientSecret = await fetchSetupIntent()

  showStripe.value = await loadStripeElement(clientSecret)

  stripeLoading.value = false
}

function cancelPaymentForm() {
  showStripe.value = false
  stripeLoading.value = true
}
</script>

<template>
  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <h2 class="text-lg text-gray-900 font-medium">
      Payment Info
    </h2>

    <ul v-if="stripeLoading || !showStripe" role="list" class="grid grid-cols-1 mt-8 gap-6 lg:grid-cols-1 sm:grid-cols-1">
      <li class="col-span-1 border rounded-lg bg-white shadow divide-y divide-gray-200">
        <div class="w-full p-4">
          <div class="flex space-x-4">
            <div class="h-24 w-24">
              <img src="/images/logos/mastercard.svg" alt="Mastercard Logo" class="border">
            </div>
            <h2 class="text-xl text-gray-600">
              Mastercard •••• 4242 <br>
              <span class="text-xs text-gray-500 italic">Expires 10/30</span>
            </h2>
          </div>

          <div class="flex justify-end space-x-4">
            <button
              type="button"
              class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              @click="handleAddPaymentMethod()"
            >
              <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
            <button
              type="button"
              class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
              @click="handleAddPaymentMethod()"
            >
              <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div v-show="!stripeLoading || showStripe">
      <form id="payment-form">
        <div id="payment-element" />
        <div class="flex pt-4 space-x-2">
          <button
            type="button"
            class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
            @click="handleAddPaymentMethod()"
          >
            Save Payment Method
          </button>

          <button
            type="button"
            class="rounded-md bg-white px-2.5 py-1.5 text-sm text-gray-700 font-semibold shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
            @click="cancelPaymentForm()"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>

    <div v-if="stripeLoading || !showStripe" class="mt-8 flex">
      <button
        type="button"
        class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
        @click="loadWebElement()"
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
