<script setup lang="ts">
  // import "./system-tray.ts"
  import {initSystemTray} from "./system-tray.ts"

  // testCall()
  initSystemTray()
</script>
<template>
  <RouterView />
</template>
