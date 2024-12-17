<script setup lang="ts">
import LoadingCard from '../skeleton/loading-card.vue'
import CardBrands from './card-brands.vue'

interface PaymentMethod {
  id: number
  brand: string
  last_four: string
  exp_month: number
  exp_year: number
}

interface Props {
  paymentMethod: PaymentMethod
}

const props = defineProps<Props>()

const paymentMethod = props.paymentMethod

const paymentStore = usePaymentStore()
</script>

<template>
  <!-- <Notification position="top-right" rich-colors /> -->

  <div class="mt-16 w-2/3 bg-white px-8 py-6 shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
    <h2 class="text-lg text-gray-900 font-medium">
      Payment Info
    </h2>

    <LoadingCard v-if="paymentStore.isStateLoading('fetchDefaultPaymentMethod') && paymentStore.isStateLoading('fetchStripeCustomer')" class="mt-8" />

    <div v-else>
      <div v-if="paymentMethod" class="col-span-1 mt-8 border rounded-lg bg-white shadow divide-y divide-gray-200">
        <div class="w-full p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <CardBrands v-if="paymentMethod.brand" :brand="paymentMethod.brand" alt="Brand Logo" />

              <h2 class="text-sm text-gray-600">
                {{ paymentMethod.brand }} •••• {{ paymentMethod.last_four }}
                <span class="ml-4 inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700 font-medium ring-1 ring-indigo-700/10 ring-inset">Default</span>
                <br>
                <span class="text-xs text-gray-500 italic">Expires {{ paymentMethod.exp_month }} /  {{ paymentMethod.exp_year }} </span>
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
  </div>
</template>
