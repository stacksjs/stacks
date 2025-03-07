<script lang="ts" setup>
import Example from './Example.vue'
import Footer from './Footer.vue'
import Hero from './Hero.vue'
import Usage from './Usage.vue'
import Installation from './Installation.vue'
import Styling from './Styling.vue'
import { useSEOHeader } from './composables/useSEOHeader'

useSEOHeader()
</script>

<template>
  <div class="dropdown-wrapper bg-neutral-100/66 px-4 dark:bg-neutral-900">
    <div class="relative mx-auto max-w-full container sm:max-w-2xl">
      <header class="flex-center flex-col py-20">
        <Hero />
      </header>

      <main
        class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
      >
        <Installation />
        <Usage />
        <Example />
        <Styling />
      </main>
      <Footer />
    </div>
  </div>
</template>

<style scoped>
.dropdown-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

button {
  border: 0px solid #000;
}
</style>
