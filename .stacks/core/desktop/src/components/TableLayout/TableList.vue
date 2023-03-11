<script setup lang="ts">
import type { MeilisearchResults } from '~/types'

interface Props {
  results?: MeilisearchResults
}

const {
  results,
} = defineProps<Props>()

const emit = defineEmits(['navigateToPage'])

function goTo(page: number) {
  emit('navigateToPage', page)
}
</script>

<template>
  <div class="mx-auto rounded-lg shadow-lg dark:border dark:border-gray-600">
    <div class="flex flex-col">
      <div class="min-w-full overflow-x-auto align-middle rounded-t-lg">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
          <slot />
        </table>
      </div>

      <Pagination
        v-if="!isEmpty(results)"
        :results="results"
        @go-to-page="goTo"
      />
    </div>
  </div>
</template>
