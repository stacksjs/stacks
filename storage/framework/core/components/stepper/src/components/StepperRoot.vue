<script lang="ts" setup>
import { defineOptions, onMounted } from 'vue';

defineOptions({
  name: 'StepperRoot',
})

onMounted(() => {
  console.log('Stepped Root Mounted');
})

</script>

<template>
  <div class="v-stepper-root">
    <slot></slot>
  </div>
</template>

<style scoped>
  .v-stepper-root {
    @apply flex w-full select-none box-border justify-between ;
  }
  .v-stepper-root *,
  .v-stepper-root *::before,
  .v-stepper-root *::after {
    box-sizing: inherit;
  }
</style>
