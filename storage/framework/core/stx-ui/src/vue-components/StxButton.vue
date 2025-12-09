<script lang="ts" setup>
/**
 * StxButton Vue Wrapper
 * Vue component wrapper for the stx-button web component.
 */
import { computed, onMounted, ref } from 'vue'
import type { ButtonVariant, ButtonSize } from '../web-components/stx-button'

// Ensure web component is registered
import '../web-components/stx-button'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  iconOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  iconOnly: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const buttonRef = ref<HTMLElement | null>(null)

const attrs = computed(() => {
  const result: Record<string, string | boolean> = {
    variant: props.variant,
    size: props.size,
  }

  if (props.disabled) result.disabled = true
  if (props.loading) result.loading = true
  if (props.fullWidth) result['full-width'] = true
  if (props.iconOnly) result['icon-only'] = true

  return result
})

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}

onMounted(() => {
  buttonRef.value?.addEventListener('click', handleClick as EventListener)
})

defineExpose({
  focus: () => (buttonRef.value as any)?.focus?.(),
  blur: () => (buttonRef.value as any)?.blur?.(),
})
</script>

<template>
  <stx-button ref="buttonRef" v-bind="attrs">
    <template v-if="$slots.iconLeft">
      <span slot="icon-left">
        <slot name="iconLeft" />
      </span>
    </template>
    <slot />
    <template v-if="$slots.iconRight">
      <span slot="icon-right">
        <slot name="iconRight" />
      </span>
    </template>
  </stx-button>
</template>
