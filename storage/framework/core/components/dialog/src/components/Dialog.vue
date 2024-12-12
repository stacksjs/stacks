<script lang="ts" setup>
import { defineCustomElement, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (event: 'close', visible: boolean): void
}>()

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
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div
      class="z-20 min-h-full flex items-end justify-center bg-gray-500 bg-opacity-75 p-4 text-center transition-opacity sm:items-center sm:p-0"
      @click.self="emit('close', false)"
    >
      <slot />
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
