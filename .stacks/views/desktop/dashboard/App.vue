<script setup lang="ts">
import { onMounted } from 'vue'
import { listen } from '@tauri-apps/api/event'

onMounted(async () => {
  const unlisten = await listen<string>('settings', (event) => {
    console.log(`Got error in window ${event.windowLabel}, payload: ${event.payload}`)
  })

  // you need to call unlisten if your handler goes out of scope e.g. the component is unmounted
})
</script>

<template>
  <RouterView />
</template>
