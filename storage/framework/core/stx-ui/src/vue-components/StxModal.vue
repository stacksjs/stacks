<script lang="ts" setup>
/**
 * StxModal Vue Wrapper
 * Vue component wrapper for the stx-modal web component.
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { ModalSize } from '../web-components/stx-modal'

// Ensure web component is registered
import '../web-components/stx-modal'

interface Props {
  modelValue?: boolean
  size?: ModalSize
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  size: 'md',
  closeOnBackdrop: true,
  closeOnEscape: true,
  showCloseButton: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'open'): void
  (e: 'close'): void
}>()

const modalRef = ref<HTMLElement | null>(null)

const attrs = computed(() => {
  const result: Record<string, string | boolean> = {
    size: props.size,
  }

  if (props.modelValue) result.open = true
  if (!props.closeOnBackdrop) result['close-on-backdrop'] = 'false'
  if (!props.closeOnEscape) result['close-on-escape'] = 'false'
  if (!props.showCloseButton) result['show-close-button'] = 'false'

  return result
})

function handleOpen() {
  emit('update:modelValue', true)
  emit('open')
}

function handleClose() {
  emit('update:modelValue', false)
  emit('close')
}

onMounted(() => {
  modalRef.value?.addEventListener('modal-open', handleOpen)
  modalRef.value?.addEventListener('modal-close', handleClose)
})

watch(() => props.modelValue, (newVal) => {
  const modal = modalRef.value as any
  if (modal) {
    modal.open = newVal
  }
})

defineExpose({
  show: () => (modalRef.value as any)?.show?.(),
  close: () => (modalRef.value as any)?.close?.(),
  toggle: () => (modalRef.value as any)?.toggle?.(),
})
</script>

<template>
  <stx-modal ref="modalRef" v-bind="attrs">
    <template v-if="$slots.header">
      <div slot="header">
        <slot name="header" />
      </div>
    </template>
    <template v-if="$slots.title">
      <span slot="title">
        <slot name="title" />
      </span>
    </template>
    <slot />
    <template v-if="$slots.footer">
      <div slot="footer">
        <slot name="footer" />
      </div>
    </template>
  </stx-modal>
</template>
