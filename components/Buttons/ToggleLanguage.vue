<script setup lang="ts">
const { t, availableLocales, locale } = useI18n()

const toggleLocales = () => {
  const locales = availableLocales
  locale.value = locales[(locales.indexOf(locale.value) + 1) % locales.length]
}
</script>

<template>
  <button
    class="btn"
    :title="t('button.toggle_langs')"
    @click="toggleLocales()"
  >
    <div class="i-heroicons-outline-language" />
  </button>
</template>
