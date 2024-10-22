<script lang="ts" setup>
import {  ref } from 'vue'

const products = ref([{
  name: 'iPhone Pro Max',
  price: 99900, // Price in cents ($999.00)
  images: 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-pro-model-unselect-gallery-2-202409?wid=5120&hei=2880&fmt=webp&qlt=70&.v=aWs5czA5aDFXU0FlMGFGRlpYRXk2UWFRQXQ2R0JQTk5udUZxTkR3ZVlpTDUwMGlYMEhQSTVNdkRDMFExUU1KbTBoUVhuTWlrY2hIK090ZGZZbk9HeE1xUVVnSHY5eU9CcGxDMkFhalkvT0FmZ0ROUGFSR25aOE5EM2xONlRwa09mbW94YnYxc1YvNXZ4emJGL0IxNFp3&traceId=1',
}])


</script>

<template>
  <div>
    <Checkout mode="one-time" :products="products" redirect-url="https://google.com" />
  </div>
</template>
