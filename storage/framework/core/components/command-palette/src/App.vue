<script setup>
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/stacks.svg" class="logo" alt="Stacks logo">
    </a>
    <a href="https://stacksjs.org/" target="_blank">
      <img src="./assets/stacks.svg" class="logo stacks" alt="Stacks logo">
    </a>
  </div>
  <HelloWorld msg="Stacks" />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
