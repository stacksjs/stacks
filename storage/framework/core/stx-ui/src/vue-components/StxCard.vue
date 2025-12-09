<script lang="ts" setup>
/**
 * StxCard Vue Wrapper
 * Vue component wrapper for the stx-card web component.
 */
import { computed, onMounted, ref } from 'vue'
import type { CardVariant, CardPadding, CardRounded } from '../web-components/stx-card'

// Ensure web component is registered
import '../web-components/stx-card'

interface Props {
  variant?: CardVariant
  padding?: CardPadding
  rounded?: CardRounded
  hoverable?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: 'md',
  rounded: 'lg',
  hoverable: false,
  clickable: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const cardRef = ref<HTMLElement | null>(null)

const attrs = computed(() => {
  const result: Record<string, string | boolean> = {
    variant: props.variant,
    padding: props.padding,
    rounded: props.rounded,
  }

  if (props.hoverable) result.hoverable = true
  if (props.clickable) result.clickable = true

  return result
})

function handleCardClick(event: CustomEvent) {
  emit('click', event.detail.originalEvent)
}

onMounted(() => {
  cardRef.value?.addEventListener('card-click', handleCardClick as EventListener)
})
</script>

<template>
  <stx-card ref="cardRef" v-bind="attrs">
    <template v-if="$slots.header">
      <div slot="header">
        <slot name="header" />
      </div>
    </template>
    <slot />
    <template v-if="$slots.footer">
      <div slot="footer">
        <slot name="footer" />
      </div>
    </template>
  </stx-card>
</template>
