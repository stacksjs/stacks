<template>
  <!-- macOS-style guest layout with subtle background -->
  <div class="min-h-screen bg-neutral-100 dark:bg-neutral-950">
    <RouterView />
  </div>
</template>

<style>
body {
  @apply bg-neutral-100 dark:bg-neutral-950;
}
</style>
