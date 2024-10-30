<script lang="ts" setup>
import { defineCustomElement, ref } from 'vue'
import Hero from './components/Hero.vue'
import Installation from './components/Installation.vue'
import Options from './components/Options.vue'
import Transitions from './components/Transitions.vue'
import Usage from './components/Usage.vue'
import { useSEOHeader } from './composables/useSEOHeader'

useSEOHeader()

const visible = ref(false)

function handleOpen() {
  visible.value = true
}

function handleClose() {
  visible.value = false
}

defineCustomElement({
  shadow: true,
})
</script>

<template>
  <div class="px-4 modal-wrapper bg-neutral-100/66 dark:bg-neutral-900">
    <div class="container relative max-w-full mx-auto sm:max-w-2xl">
      <header class="flex-col py-20 flex-center">
        <Hero @open="handleOpen" />
      </header>

      <main
        class="grid grid-cols-1 gap-8 pb-20 text-xs text-primary 2xl:text-sm"
      >
        <Installation />
        <Usage />
        <Options />
        <Transitions />
      </main>

      <Modal :visible="visible" @close="handleClose" transition="fade">
        <template #closeButton />
        <template #header>
          <h1> Hello Detail</h1>
        </template>

        <p>Modal Content</p>
      </Modal>

      <Footer />
    </div>
  </div>
</template>

<style scoped>
.modal-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

/* @unocss-placeholder */
</style>
