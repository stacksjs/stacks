<script lang="ts" setup>
import Example from './Example.vue'
import Footer from './Footer.vue'
import Hero from './Hero.vue'
import Installation from './Installation.vue'
import Usage from './Usage.vue'
</script>

<template>
  <div class="stepper-wrapper bg-neutral-100/66 px-4 dark:bg-neutral-900">
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
        <Footer />
      </main>
    </div>
  </div>
</template>

<style>
.stepper-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

button {
  border: 0px solid #000;
}


</style>
