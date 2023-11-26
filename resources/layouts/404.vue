<script setup lang="ts">
const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="px-4 py-10 text-center text-teal-700 text-dark:gray-200">
    <div class="text-4xl">
      <div class="i-carbon-warning inline-block" />
      testing this
    </div>

    <RouterView />

    <div>
      <button class="text-sm btn m-3 mt-8" @click="router.back()">
        {{ t('button.back') }}
      </button>
    </div>
  </main>
</template>
