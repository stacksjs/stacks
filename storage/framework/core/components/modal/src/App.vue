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
  <div class="modal-wrapper bg-neutral-100/66 px-4 dark:bg-neutral-900">
    <div class="relative mx-auto max-w-full container sm:max-w-2xl">
      <header class="flex-center flex-col py-20">
        <Hero @open="handleOpen" />
      </header>

      <main
        class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm"
      >
        <Installation />
        <Usage />
        <Options />
        <Transitions />
      </main>

      <Modal close-button :visible="visible" @close="handleClose">
        <template #header>
          <h2>
            Modal with title
          </h2>
        </template>
        <div>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.
        </div>
      </Modal>
      <Footer />
    </div>
  </div>
</template>

<style>
.modal-wrapper {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
    Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
}

button {
  border: 0px solid #000;
}

/* @unocss-placeholder */
</style>
