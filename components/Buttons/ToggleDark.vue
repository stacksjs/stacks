<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <button
    class="btn"
    :title="t('button.toggle_dark')"
    @click="toggleDark()"
  >
    <div class="i-heroicons-outline-sun dark:i-heroicons-outline-moon" />
  </button>
</template>
