<script setup lang="ts">
const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="props.class" @click.stop>
    <slot>
      <p>Default modal content goes here.</p>
    </slot>
  </div>
</template>
