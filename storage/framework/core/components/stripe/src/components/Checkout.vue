<script setup lang="ts">
interface Products {
  name: string
  price: number
  images: string
}

interface Props {
  products: Products[]
  redirectUrl: string
  mode: 'one-time' | 'subscription'
  applePay?: boolean
  googlePay?: boolean
}

const props = defineProps<Props>()

const products = props.products
</script>

<template>
  <OneTimePayment v-if="mode === 'one-time'" :products="products" :redirect-url="props.redirectUrl" />
  <Subscription v-if="mode === 'subscription'" :products="products" :redirect-url="props.redirectUrl" />
</template>
