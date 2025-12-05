<script setup lang="ts">
/**
 * Page Header Component
 * A consistent header for dashboard pages with title, description, and actions.
 */

interface Props {
  title: string
  description?: string
  backLink?: string
  backLabel?: string
}

const props = defineProps<Props>()

const router = useRouter()

function handleBack() {
  if (props.backLink) {
    router.push(props.backLink)
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="mb-6">
    <!-- Back link -->
    <button
      v-if="backLink || $slots.back"
      type="button"
      class="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors mb-3"
      @click="handleBack"
    >
      <div class="i-hugeicons-arrow-left-01 w-4 h-4" />
      <span>{{ backLabel || 'Back' }}</span>
    </button>

    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div class="min-w-0 flex-1">
        <!-- Title row -->
        <div class="flex items-center gap-3">
          <slot name="icon" />
          <div>
            <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white truncate">
              {{ title }}
            </h1>
            <p
              v-if="description"
              class="mt-1 text-sm text-neutral-500 dark:text-neutral-400"
            >
              {{ description }}
            </p>
          </div>
        </div>

        <!-- Tags/badges slot -->
        <div v-if="$slots.tags" class="mt-2 flex flex-wrap gap-2">
          <slot name="tags" />
        </div>
      </div>

      <!-- Actions -->
      <div v-if="$slots.actions" class="flex items-center gap-2 flex-shrink-0">
        <slot name="actions" />
      </div>
    </div>

    <!-- Tabs slot -->
    <div v-if="$slots.tabs" class="mt-4 border-b border-neutral-200 dark:border-neutral-700">
      <slot name="tabs" />
    </div>

    <!-- Filters slot -->
    <div v-if="$slots.filters" class="mt-4">
      <slot name="filters" />
    </div>
  </div>
</template>
