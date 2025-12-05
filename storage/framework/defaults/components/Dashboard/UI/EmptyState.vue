<script setup lang="ts">
/**
 * Empty State Component
 * Displays when there's no data or content to show.
 */

interface Props {
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-hugeicons-folder-02',
})

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <!-- Icon -->
    <div class="mb-4 p-4 rounded-full bg-neutral-100 dark:bg-neutral-800">
      <slot name="icon">
        <div :class="[icon, 'w-8 h-8 text-neutral-400 dark:text-neutral-500']" />
      </slot>
    </div>

    <!-- Title -->
    <h3 class="text-lg font-medium text-neutral-900 dark:text-white mb-1">
      {{ title }}
    </h3>

    <!-- Description -->
    <p v-if="description" class="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">
      {{ description }}
    </p>

    <!-- Action button -->
    <button
      v-if="actionLabel"
      type="button"
      class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
      @click="emit('action')"
    >
      <div v-if="actionIcon" :class="[actionIcon, 'w-4 h-4']" />
      {{ actionLabel }}
    </button>

    <!-- Custom action slot -->
    <slot name="action" />
  </div>
</template>
