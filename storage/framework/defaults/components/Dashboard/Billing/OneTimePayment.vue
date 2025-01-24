<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'

import PaymentForm from './PaymentForm.vue'

interface Props {
  product: number,
  paymentIntent: string,
}

const props = defineProps<Props>()

const paymentStore = usePaymentStore()

const { isEmpty } = useBillable()

const productId = computed(() => {
  return props.product || 1
})

const unitPrice = computed(() => {
  return `$${(paymentStore.getProduct.unit_price / 100).toFixed(2)}`
})

onMounted(async () => {
  await paymentStore.fetchProduct(productId.value)
})
</script>

<template>
  <div v-if="!isEmpty(paymentStore.getProduct)" class="flex border border-gray-200 rounded-md p-4 space-x-2">
    <ul role="list" class="w-1/3 text-sm text-gray-900 font-medium divide-y divide-gray-200">
      <li class="items-ce flex space-x-4">
        <img src="https://tailwindui.com/plus/img/ecommerce-images/checkout-page-04-product-01.jpg" alt="Moss green canvas compact backpack with double top zipper, zipper front pouch, and matching carry handle and backpack straps." class="size-20 flex-none border rounded-md object-cover">
        <div class="mt-2 flex-auto space-y-1">
          <h3>{{ paymentStore.getProduct.name }}</h3>
          <p class="flex-none text-sm font-medium">
            {{ unitPrice || '$00.00' }}
          </p>
        </div>
      </li>
    </ul>
    <PaymentForm :paymentIntent="props.paymentIntent" :product-id="1" :price="unitPrice" class="w-2/3" />
  </div>
</template>
