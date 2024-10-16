<script lang="ts" setup>
// import type { Position, Theme } from './types'
import { defineCustomElement, ref } from 'vue'
import { Modal } from './components'
import Hero from './components/Hero.vue'
import Installation from './components/Installation.vue'
import Styling from './components/Styling.vue'
import Usage from './components/Usage.vue'
import { useSEOHeader } from './composables/useSEOHeader'
// import { toggleDarkMode, isDark } from './composables/useDarkMode'

useSEOHeader()

// const expand = ref(false)
// const position = ref<Position>('top-right')
// const richColors = ref(false)
// const closeButton = ref(false)
// const theme = ref<Theme>('light')

const visible = ref(true)

function handleClose() {
  visible.value = false
}

defineCustomElement({
  shadow: true,
})
</script>

<template>
  <div class="modal-wrapper bg-neutral-100/66 px-4 dark:bg-neutral-900">
    <div class="relative mx-auto max-w-full container sm:max-w-2xl">
      <header class="flex-center flex-col py-20">
        <Hero />
      </header>

      <main
        class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
      >
        <Installation />
        <Usage />

        <Styling />

        <button @click="visible = true">
          Open Modal
        </button>
      </main>
      <Footer />
    </div>

    <Modal :visible="visible" @close="handleClose">
      <div>
        Welcome to stacks modal
      </div>
    </Modal>
  </div>
</template>

<style>
.modal-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

/* @unocss-placeholder */
</style>
