<script lang="ts" setup>
defineProps<{
  visible: boolean
}>()

const bars = Array.from({ length: 12 }).fill(0)
</script>

<template>
  <div class="sonner-loading-wrapper" :data-visible="visible">
    <div class="sonner-spinner">
      <template v-for="bar in bars" :key="`spinner-bar-${bar}`">
        <div class="sonner-loading-bar" />
      </template>
    </div>
  </div>
</template>
