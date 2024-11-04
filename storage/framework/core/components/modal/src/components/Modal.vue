<script lang="ts" setup>
import { defineCustomElement, onMounted, onUnmounted, useSlots } from 'vue'

const props = defineProps<{
  visible: boolean
  className?: string
}>()

const emit = defineEmits<{
  (event: 'close', visible: boolean): void
}>()

const slots = useSlots()

function handleClose() {
  emit('close', false)
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})

defineCustomElement({
  shadow: true,
})
</script>
<template>
  <div v-if="props.visible" class="fixed inset-0 z-10 w-screen overflow-y-auto">
    <div
      v-if="props.visible"
      class="min-h-full flex items-end justify-center p-4 text-center sm:items-center sm:p-0"
      @click.self="handleClose"
    >
      <div
        class="transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl sm:my-8 sm:max-w-lg sm:w-full sm:p-6"
        @click.stop
      >
        <div v-if="slots.closeButton" class="absolute right-0 top-0 pr-4 pt-4 sm:block">
          <div v-if="slots.closeButton().length === 0">
            <button
              type="button"
              class="rounded-md border-none bg-transparent text-gray-400 hover:text-gray-500 focus:outline-none"
              @click="handleClose"
            >
              <span class="sr-only">Close</span>
              <div class="i-heroicons-x-mark h-8 w-8" />
            </button>
          </div>
          <slot v-else name="closeButton" />
        </div>

        <div v-if="slots.header" class="w-full flex">
          <div class="flex items-center justify-between">
            <slot name="header" />
          </div>
        </div>

        <div class="w-full flex">
          <slot>
            <p>Default modal content goes here.</p>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button {
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* @unocss-placeholder */
</style>
