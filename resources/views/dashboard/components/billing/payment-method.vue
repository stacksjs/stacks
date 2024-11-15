<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'
import CardBrands from './card-brands.vue'

import PaymentMethodList from './payment-method-list.vue'

const paymentStore = usePaymentStore()

const stripeLoading = ref(true)
const showStripe = ref(false)

const { fetchSetupIntent, loadStripeElement, isEmpty, handleAddPaymentMethod } = useBillable()

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

    <div v-if="!paymentStore.hasPaymentMethods">
      <div class="col-span-1 mt-8 border rounded-lg bg-white shadow divide-y divide-gray-200">
        <div class="w-full px-4 py-5">
          <h2 class="text-center text-sm text-gray-600">
            You haven't added any payment methods yet.
          </h2>
        </div>
      </div>
    </div>
    <div v-if="!isEmpty(paymentStore.getDefaultPaymentMethod)" class="col-span-1 mt-8 border rounded-lg bg-white shadow divide-y divide-gray-200">
      <div class="w-full p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <CardBrands :brand="paymentStore.getDefaultPaymentMethod.card.brand" alt="Brand Logo" />
            <h2 class="text-sm text-gray-600">
              {{ paymentStore.getDefaultPaymentMethod.card.brand }} •••• {{ paymentStore.getDefaultPaymentMethod.card.last4 }}
              <span class="ml-4 inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700 font-medium ring-1 ring-indigo-700/10 ring-inset">Default</span>
              <br>
              <span class="text-xs text-gray-500 italic">Expires {{ paymentStore.getDefaultPaymentMethod.card.exp_month }} /  {{ paymentStore.getDefaultPaymentMethod.card.exp_year }} </span>
            </h2>
          </div>

          <div class="flex justify-end space-x-4">
            <button
              type="button"
              class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
            >
              <svg class="h-4 w-4 text-gray-700" data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    <PaymentMethodList />

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

    <div v-if="stripeLoading || !showStripe" class="mt-8 flex justify-end">
      <button
        type="button"
        class="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
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
