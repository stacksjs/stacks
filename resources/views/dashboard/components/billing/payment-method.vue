<script setup lang="ts">
// import { Notification } from '@stacksjs/notification'
import { useBillable } from '../../../../functions/billing/payments'
import LoadingCard from '../skeleton/loading-card.vue'
import CardBrands from './card-brands.vue'
import CardForm from './card-form.vue'

import PaymentMethodList from './payment-method-list.vue'

const paymentStore = usePaymentStore()

const isLoadingWebElement = ref(false)
const showCardForm = ref(false)

const { isEmpty } = useBillable()

async function loadWebElement() {
  isLoadingWebElement.value = true

  showCardForm.value = true
  isLoadingWebElement.value = false
}

function cancelForm() {
  showCardForm.value = false
}

// async function submitPaymentMethod(clientSecret: string, elements: any) {
//   await handleAddPaymentMethod(clientSecret, elements)

//   await paymentStore.fetchDefaultPaymentMethod()
//   await paymentStore.fetchUserPaymentMethods()

//   showStripe.value = false
// }

// function cancelPaymentForm() {
//   showStripe.value = false
// }
</script>

<template>
  <!-- <Notification position="top-right" rich-colors /> -->

  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <h2 class="text-lg text-gray-900 font-medium">
      Payment Info
    </h2>

    <LoadingCard v-if="paymentStore.isStateLoading('fetchDefaultPaymentMethod') && paymentStore.isStateLoading('fetchStripeCustomer')" class="mt-8" />

    <div v-else>
      <div v-if="!isEmpty(paymentStore.getDefaultPaymentMethod)" class="col-span-1 mt-8 border rounded-lg bg-white shadow divide-y divide-gray-200">
        <div class="w-full p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <CardBrands v-if="paymentStore.getDefaultPaymentMethod.brand" :brand="paymentStore.getDefaultPaymentMethod.brand" alt="Brand Logo" />

              <h2 class="text-sm text-gray-600">
                {{ paymentStore.getDefaultPaymentMethod.brand }} •••• {{ paymentStore.getDefaultPaymentMethod.last_four }}
                <span class="ml-4 inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700 font-medium ring-1 ring-indigo-700/10 ring-inset">Default</span>
                <br>
                <span class="text-xs text-gray-500 italic">Expires {{ paymentStore.getDefaultPaymentMethod.exp_month }} /  {{ paymentStore.getDefaultPaymentMethod.exp_year }} </span>
              </h2>
            </div>
          </div>
        </div>
      </div>

      <div v-else>
        <div class="col-span-1 mt-8 border rounded-lg bg-white shadow divide-y divide-gray-200">
          <div class="w-full px-4 py-5">
            <h2 class="text-center text-sm text-gray-600">
              You haven't added any payment methods yet.
            </h2>
          </div>
        </div>
      </div>
    </div>

    <PaymentMethodList :user-id="1" />

    <CardForm v-if="showCardForm" @cancel-payment-method-addition="cancelForm" />

    <div v-if="!showCardForm" class="mt-8 flex justify-end">
      <button
        type="button"
        class="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
        @click="loadWebElement()"
      >
        <span v-if="isLoadingWebElement" class="inline-flex items-center">
          <div class="i-heroicons-arrow-path-rounded-square-20-solid animate-spin" />
          <span class="ml-2">Loading...</span>
        </span>
        <span v-else>Add Payment Method</span>
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
