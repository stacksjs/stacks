<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: boolean
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
        <div class="stacks-dialog-content">
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
