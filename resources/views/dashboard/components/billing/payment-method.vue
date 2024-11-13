<script setup lang="ts">
import { useBillable } from '../../../../functions/billing/payments'

const stripeLoading = ref(true)
const showStripe = ref(false)

const { fetchSetupIntent, loadStripeElement } = useBillable()

async function addPaymentMethod() {
 const clientSecret = await fetchSetupIntent()

  const paymentElement = await loadStripeElement(clientSecret)

  if (paymentElement) {
    paymentElement.mount('#payment-element')

    showStripe.value = true
  }

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

    <div class="pt-4 space-x-2" v-if="stripeLoading || !showStripe">
      <div class="h-12 w-12">
        <img src="/images/logos/mastercard.svg" alt="Mastercard Logo">
      </div>

      <h2 class="text-xl text-gray-600">
        •••• •••• •••• ••••
      </h2>

      <h2 class="text-xl text-gray-600">
        No payment method added yet.
      </h2>
    </div>

    <div v-show="!stripeLoading || showStripe">
      <form id="payment-form">
        <div id="payment-element">
        </div>
        <div class="flex pt-4 space-x-2">
          <button
          type="button"
          class="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
          @click="cancelPaymentForm()"
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

    <div class="mt-8 flex" v-if="stripeLoading || !showStripe">
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
