<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  align?: 'left' | 'right'
  width?: 'auto' | 'sm' | 'md' | 'lg' | 'full'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  align: 'left',
  width: 'auto',
  disabled: false,
})

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

const widthClasses = computed(() => {
  const widths = {
    auto: 'min-w-[12rem]',
    sm: 'w-48',
    md: 'w-56',
    lg: 'w-64',
    full: 'w-full',
  }
  return widths[props.width]
})

const alignClasses = computed(() => {
  return props.align === 'right' ? 'right-0' : 'left-0'
})

function toggle() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function close() {
  isOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (
    isOpen.value &&
    triggerRef.value &&
    menuRef.value &&
    !triggerRef.value.contains(target) &&
    !menuRef.value.contains(target)
  ) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// Expose methods for programmatic control
defineExpose({ open: () => (isOpen.value = true), close, toggle })
</script>

<template>
  <div class="relative inline-block text-left">
    <!-- Trigger -->
    <div ref="triggerRef" @click="toggle">
      <slot name="trigger" :is-open="isOpen" />
    </div>

    <!-- Menu -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        :class="[
          'absolute z-50 mt-2',
          widthClasses,
          alignClasses,
          'origin-top-right',
          'bg-white dark:bg-neutral-800',
          'rounded-lg',
          'shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-neutral-700',
          'py-1',
          'focus:outline-none',
        ]"
      >
        <slot :close="close" />
      </div>
    </Transition>
  </div>
</template>
