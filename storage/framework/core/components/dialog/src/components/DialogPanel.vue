<script setup lang="ts">
defineProps<{
  class?: string
}>()
</script>

<template>
  <div class="p-4 bg-white rounded-lg"  @click.stop>
    <slot>
      <p>Default modal content goes here.</p>
    </slot>
  </div>
</template>
