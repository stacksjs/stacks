<script setup lang="ts">
import { useBillable } from '../../../functions/billing/payments'

interface Props {
  productId: number
  price: string,
  paymentIntent: string,
}

const props = defineProps<Props>()

const emit = defineEmits(['cancelPayment'])
const { loadPaymentForm, handlePayment } = useBillable()
const paymentStore = usePaymentStore()

const element = ref(null as any)

onMounted(async () => {
  element.value = await loadPaymentForm(props.paymentIntent)
})

async function pay() {
  await paymentStore.storeTransaction(1, props.productId)

  await handlePayment(element.value)

  emit('cancelPayment')
}
</script>

<template>
  <div>
    <form
      id="payment-form"
    >
      <div id="link-authentication-element" />
      <div id="payment-element" />

      <div class="mt-6 flex space-x-2">
        <button type="button" class="w-full rounded bg-indigo-600 px-2 py-1.5 text-sm text-white font-semibold shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 focus-visible:outline" @click="pay">
          Pay {{ props.price }}
        </button>

        <button type="button" class="w-full rounded bg-white px-2 py-1.5 text-sm text-gray-900 font-semibold shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50" @click="emit('cancelPayment')">
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
