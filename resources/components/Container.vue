<script setup lang="ts">
const props = defineProps<{
  className?: string
}>()

const computedClass = computed(() => {
  return ['mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', props.className]
})
</script>

<template>
  <div :class="computedClass" v-bind="$attrs">
    <slot />
  </div>
</template>
