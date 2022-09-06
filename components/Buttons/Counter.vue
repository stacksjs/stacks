<script setup lang="ts">
// const { t } = useI18n()
</script>

<template>
  <div>
    <button
      type="button"
      class="btn text-xs"
      @click="increment"
    >
      <i
        class="i-heroicons-outline-plus -ml-1 mr-3 h-4 w-4"
        aria-hidden="true"
      />
      <!-- {{ t('button.counter') }}: {{ count }} -->
      Counter: {{ count }}
    </button>
  </div>
</template>
