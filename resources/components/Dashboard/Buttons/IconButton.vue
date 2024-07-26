<script setup lang="ts">
const props = defineProps<{
  to: string
  active?: boolean
}>()
</script>

<style scoped>
.router-link-active, .router-link-exact-active {
  @apply dark:bg-blue-gray-700 bg-blue-gray-50 dark:text-blue-300 text-gray-600 flex items-center text-sm rounded-md !important
}
</style>

<template>
  <RouterLink
    :to="props.to"
    :class="[
      'flex flex-row items-center gap-2 bg-primary',
      'p-1 rounded-md',
    ]"
  >
    <div :class="[
      'flex items-center justify-center relative',
      'p-1 rounded-md',
      'bg-gray-8',
    ]">
      <span :class="[
        'text-white',
        'w-6 h-6',
      ]" />
    </div>

    <span class="text-gray-8 !text-sm">
      <slot />
    </span>
  </RouterLink>
</template>
