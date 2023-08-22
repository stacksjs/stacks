<script setup lang="ts">
const params = {}

await fetch.post('users', { body: params })
</script>

<template>
  <span>Welcome to stacks!</span>
</template>
