<script setup lang="ts">
import { notification } from '@stacksjs/notification'
import { Popover, PopoverButton, PopoverPanel } from '@stacksjs/popover'
import LoadingCard from '../skeleton/loading-card.vue'
import CardBrands from './card-brands.vue'

const isDefaultLoading = ref<{ [key: string]: boolean }>({})

const paymentStore = usePaymentStore()

async function deletePayment(paymentMethodId: string) {
  await paymentStore.deletePaymentMethod(paymentMethodId)

  paymentStore.fetchUserPaymentMethods()
  notification.success('Payment method deleted')
}

async function makeDefault(paymentMethodId: string) {
  isDefaultLoading.value[paymentMethodId] = true

  await paymentStore.updateDefaultPaymentMethod(paymentMethodId)

  await paymentStore.fetchUserPaymentMethods()
  await paymentStore.fetchDefaultPaymentMethod()

  notification.success('Default payment method updated')
  isDefaultLoading.value[paymentMethodId] = false
}
</script>

<template>
  <div class="mt-4">
    <LoadingCard v-if="paymentStore.isStateLoading('fetchUserPaymentMethods')" />

    <ul v-else role="list" class="grid grid-cols-1 gap-6 lg:grid-cols-1 sm:grid-cols-1">
      <li v-for="(method, index) in paymentStore.getPaymentMethods" :key="index" class="col-span-1 border rounded-lg bg-white shadow divide-y divide-gray-200">
        <div class="w-full p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <CardBrands :brand="method.card.brand" alt="Brand Logo" />
              <h2 class="text-sm text-gray-600">
                {{ method.card.brand }} •••• {{ method.card.last4 }} <br>
                <span class="text-xs text-gray-500 italic">Expires {{ method.card.exp_month }} /  {{ method.card.exp_year }} </span>
              </h2>
            </div>

            <div class="flex justify-end space-x-4">
              <button
                type="button"
                class="border rounded-md bg-white px-2 py-1 text-sm text-white font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline"
                :disabled="isDefaultLoading[method.id]"
                @click="makeDefault(method.id)"
              >
                <span v-if="!isDefaultLoading[method.id]" class="i-heroicons-star text-gray-700" />
                <span v-if="isDefaultLoading[method.id]" class="i-heroicons-arrow-path-rounded-square-20-solid animate-spin text-gray-500" />
              </button>

              <Popover v-slot="{ open }">
                <PopoverButton>
                  <div
                    :class="open ? 'text-red-500' : 'text-red-500/90'"
                    class="border rounded-md bg-white px-2 py-1 text-sm font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2 focus-visible:outline"
                  >
                    <span class="i-heroicons-trash text-red-500" />
                  </div>
                </PopoverButton>

                <PopoverPanel
                  class="absolute z-10 mt-2 w-56 border border-gray-200 rounded-lg bg-white p-4 text-xs shadow-lg"
                >
                  <span> Delete Payment Method? </span>
                  <div class="mt-2 flex justify-end space-x-4">
                    <button
                      class="border rounded-md bg-white px-2 py-1 text-sm text-red-500 font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2 focus-visible:outline"
                      @click="deletePayment(method.id)"
                    >
                      Yes
                    </button>
                    <button
                      class="border rounded-md bg-white px-2 py-1 text-sm font-semibold shadow-sm hover:bg-blue-gray-50 focus-visible:outline-2 focus-visible:outline-red-600 focus-visible:outline-offset-2 focus-visible:outline"
                      @click="open = false"
                    >
                      No
                    </button>
                  </div>
                </PopoverPanel>

                <!-- <PopoverPanel class="absolute z-10">
                  <div class="p-4 bg-white rounded-lg shadow-lg  ">
                    <h3 class="text-sm leading-6 text-gray-900">Delete Payment Method</h3>
                  </div>
                </PopoverPanel> -->
              </Popover>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped></style>
