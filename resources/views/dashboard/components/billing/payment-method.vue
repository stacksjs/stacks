<script setup lang="ts">
import CardBrands from './card-brands.vue'
import PaymentMethodList from './payment-method-list.vue'

import { useBillable } from '../../../../functions/billing/payments'

const paymentStore = usePaymentStore()

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

function isEmpty(defaultPaymentMethod: any) {
  return !defaultPaymentMethod // Checks for null or undefined
    || (typeof defaultPaymentMethod === 'object'
      && Object.keys(defaultPaymentMethod).length === 0)
}

onMounted(async () => {
  await paymentStore.fetchDefaultPaymentMethod()
})
</script>

<template>
  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <h2 class="text-lg text-gray-900 font-medium">
      Payment Info
    </h2>

    <div v-if="!isEmpty(paymentStore.getDefaultPaymentMethod)" class="col-span-1 border rounded-lg bg-white shadow divide-y divide-gray-200">
      <div class="w-full p-4">
        <div class="flex space-x-4">
          <CardBrands :brand="paymentStore.getDefaultPaymentMethod.card.brand" />
          <h2 class="text-xl text-gray-600">
            {{ paymentStore.getDefaultPaymentMethod.card.brand }} •••• {{ paymentStore.getDefaultPaymentMethod.card.last4 }}
            <br>
            <span class="text-xs text-gray-500 italic">Expires {{ paymentStore.getDefaultPaymentMethod.card.exp_month }} /  {{ paymentStore.getDefaultPaymentMethod.card.exp_year }} </span>
          </h2>

          <div>
            <span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-sm text-xs text-indigo-700 font-medium ring-1 ring-indigo-700/10 ring-inset">Default</span>
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
