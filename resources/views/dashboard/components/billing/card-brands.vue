<script setup lang="ts">
import { computed, defineProps } from 'vue'

const props = defineProps<{
  brand: string
}>()

const logoSrc = computed(() => {
  switch (props.brand.toLowerCase()) {
    case 'visa':
      return '/images/logos/visa.png'
    case 'mastercard':
    case 'mc':
      return '/images/logos/mastercard.svg'
    case 'amex':
    case 'american express':
      return '/images/logos/amex.jpg'
    default:
      return '/images/logos/default-card.svg' // Path to a default card image if brand is unrecognized
  }
})
</script>

<template>
  <div class="w-24 h-24">
    <img :src="logoSrc" :alt="`${brand} Logo`" />
  </div>
</template>