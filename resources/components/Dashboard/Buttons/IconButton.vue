<script setup lang="ts">
const props = defineProps<{
  to: string
  active?: boolean
}>()
</script>

<template>
  <RouterLink
    :to="props.to"
    class="bg-primary flex flex-row items-center gap-2 rounded-md p-1"
  >
    <div
      class="relative flex items-center justify-center rounded-md bg-gray-8 p-1"
    >
      <span
        class="h-6 w-6 text-white"
      />
    </div>

    <span class="text-gray-8 !text-sm">
      <slot />
    </span>
  </RouterLink>
</template>

<style scoped>
.router-link-active, .router-link-exact-active {
  @apply dark:bg-blue-gray-700 bg-blue-gray-50 dark:text-blue-300 text-gray-600 flex items-center text-sm rounded-md !important
}
</style>
