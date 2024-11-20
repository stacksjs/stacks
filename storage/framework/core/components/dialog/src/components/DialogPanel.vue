<script setup lang="ts">
import { defineCustomElement } from 'vue'

defineCustomElement({
  shadow: true,
})
</script>

<template>
  <div class="z-60 overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl sm:my-8 sm:max-w-lg sm:w-full sm:p-6" @click.stop >
    <slot>
      <p>Default modal content goes here.</p>
    </slot>
  </div>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
