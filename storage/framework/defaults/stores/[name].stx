<script setup lang="ts">
const router = useRouter()
// get the [name] of current route
const name = computed(() => router.currentRoute.value.params.name)

// set the title of the page
useHead({
  title: `Dashboard Settings - ${name.value}`,
})
</script>

<template>
  <main>
    <div class="flex gap-x-4">
      <SettingsSidebar />

      <div class="mx-auto p-4 container lg:p-8 sm:p-6">
        <SettingsFormManager :name="name" />
      </div>
    </div>
  </main>
</template>
