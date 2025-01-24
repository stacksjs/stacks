<script setup lang="ts">
const props = defineProps<{
  brand: string
  width?: number
}>()

const defaultProps = {
  width: 4,
}

const { brand, width = defaultProps.width } = props

const logoSrc = computed(() => {
  if (!props.brand)
    return ''

  switch (props.brand.toLowerCase()) {
    case 'visa':
      return '/images/logos/visa.png'
    case 'mastercard':
    case 'mc':
      return '/images/logos/mastercard.svg'
    case 'jcb':
      return '/images/logos/jcb.svg'
    case 'amex':
    case 'american express':
      return '/images/logos/amex.jpg'
    default:
      return '/images/logos/default-card.svg' // Path to a default card image if brand is unrecognized
  }
})
</script>

<template>
  <div :style="`width: ${width}rem`">
    <img :src="logoSrc" :alt="`${brand} Logo`">
  </div>
</template>
