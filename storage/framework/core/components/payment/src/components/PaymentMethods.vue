<script setup lang="ts">
import LoadingCard from '../skeleton/loading-card.vue'
import CardBrands from './card-brands.vue'

const props = defineProps<Props>()
const emit = defineEmits(['deletePaymentMethod', 'makeDefault'])
const isDefaultLoading = ref<{ [key: string]: boolean }>({})
interface PaymentMethod {
  id: number
  brand: string
  last_four: string
  exp_month: number
  exp_year: number
}

interface Props {
  paymentMethods: PaymentMethod[]
}

const paymentMethods = props.paymentMethods

const paymentStore = usePaymentStore()
</script>

<template>
  <div class="mt-4">
    <LoadingCard v-if="paymentStore.isStateLoading('fetchUserPaymentMethods') && paymentStore.isStateLoading('fetchStripeCustomer')" />

    <ul v-else role="list" class="grid grid-cols-1 gap-6 lg:grid-cols-1 sm:grid-cols-1">
      <li v-for="(method, index) in paymentMethods" :key="index" class="col-span-1 border rounded-lg bg-white shadow divide-y divide-gray-200">
        <div class="w-full p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <CardBrands :brand="method.brand" alt="Brand Logo" />
              <h2 class="text-sm text-gray-600">
                {{ method.brand }} •••• {{ method.last_four }} <br>
                <span class="text-xs text-gray-500 italic">Expires {{ method.exp_month }} /  {{ method.exp_year }} </span>
              </h2>
            </div>

            <div class="flex justify-end space-x-4">
              <button
                type="button"
                class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
                :disabled="isDefaultLoading[method.id]"
                @click="emit('makeDefault', method.id)"
              >
                <span v-if="!isDefaultLoading[method.id]" class="i-hugeicons-star text-gray-700" />
                <span v-if="isDefaultLoading[method.id]" class="i-hugeicons-arrow-path-rounded-square-20-solid animate-spin text-gray-500" />
              </button>

              <button
                type="button"
                class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
                :disabled="isDefaultLoading[method.id]"
                @click="emit('deletePaymentMethod', method.id)"
              >
                <span class="i-hugeicons-trash text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped></style>
