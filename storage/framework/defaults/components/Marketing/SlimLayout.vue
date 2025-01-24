<script setup lang="ts">
import backgroundImage from '../../../../../public/images/background-auth.jpg'
</script>

<template>
  <div class="relative min-h-full flex shrink-0 justify-center lg:px-0 md:px-12">
    <div class="relative z-10 flex flex-1 flex-col bg-white px-4 py-10 shadow-2xl md:flex-none sm:justify-center md:px-28">
      <main class="mx-auto max-w-md w-full md:max-w-sm md:w-96 md:px-0 sm:px-4">
        <slot />
      </main>
    </div>
    <div class="hidden lg:relative lg:block sm:contents lg:flex-1">
      <img class="absolute inset-0 h-full w-full object-cover" :src="backgroundImage" alt="">
    </div>
  </div>
</template>
