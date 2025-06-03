<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: boolean
  width?: number
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'close', visible: boolean): void
}>()

const dialogRef = ref<HTMLElement | null>(null)
const previousActiveElement = ref<HTMLElement | null>(null)

function handleClose() {
  emit('update:modelValue', false)
  emit('close', false)
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()
  }
}

function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return

  const focusableElements = dialogRef.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )

  if (!focusableElements?.length) return

  const firstFocusable = focusableElements[0] as HTMLElement
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

  if (event.shiftKey) {
    if (document.activeElement === firstFocusable) {
      lastFocusable.focus()
    }
  } else {
    if (document.activeElement === lastFocusable) {
      firstFocusable.focus()
    }
  }
}

watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    previousActiveElement.value = document.activeElement as HTMLElement
    nextTick(() => {
      dialogRef.value?.focus()
    })
  } else if (previousActiveElement.value) {
    previousActiveElement.value.focus()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
  window.addEventListener('keydown', trapFocus)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener('keydown', trapFocus)
})
</script>

<template>
  <Transition name="dialog-fade">
    <div v-if="modelValue" class="stacks-dialog-container">
     
      <div
        class="stacks-dialog-backdrop"
        @click.self="handleClose"
      >
        <div class="stacks-dialog-content"
          :style="{ 'max-width': width ? `${width}rem` : '30rem' }"
        >
          <button class="stacks-dialog-close" @click="handleClose" aria-label="Close dialog">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.stacks-dialog-container {
  position: fixed !important;
  inset: 0 !important;
  z-index: 50 !important;
  min-height: 100% !important;
  overflow-y: auto !important;
}

.stacks-dialog-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 20 !important;
  display: flex !important;
  align-items: flex-end !important;
  justify-content: center !important;
  min-height: 100% !important;
  padding: 1rem !important;
  text-align: center !important;
  transition-property: opacity !important;
  background-color: rgb(107 114 128 / 0.75) !important;
}

.stacks-dialog-content {
  position: relative !important;
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background-color: white !important;
  border-radius: 0.5rem !important;
  padding: 1.5rem !important;
  margin: 1rem !important;
}

.stacks-dialog-close {
  position: absolute !important;
  top: 1rem !important;
  right: 1rem !important;
  width: 2rem !important;
  height: 2rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 9999px !important;
  background-color: white !important;
  border: 1px solid rgb(229 231 235) !important;
  color: rgb(107 114 128) !important;
  cursor: pointer !important;
  transition: background-color 0.2s ease !important;
  padding: 0.25rem !important;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1) !important;
  z-index: 30 !important;
}

.stacks-dialog-close svg {
  width: 1.25rem !important;
  height: 1.25rem !important;
}

.stacks-dialog-close:hover {
  background-color: rgb(229 231 235) !important;
}

@media (min-width: 640px) {
  .stacks-dialog-backdrop {
    align-items: center !important;
    padding: 0 !important;
  }
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.3s ease !important;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0 !important;
}
</style>
