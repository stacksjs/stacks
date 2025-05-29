<script setup lang="ts">
import backgroundImage from '../../../public/images/background-auth.jpg'
</script>

<template>
  <div class="relative min-h-full flex shrink-0 justify-center lg:px-0 md:px-12">
    <div class="relative z-10 flex flex-1 flex-col bg-white px-4 py-10 shadow-2xl md:flex-none sm:justify-center md:px-28">
      <main class="mx-auto max-w-md w-full md:max-w-sm md:w-96 md:px-0 sm:px-4">
        <div class="flex">
          <router-link to="/" aria-label="Home">
            <Logo class="h-10 w-auto" />
          </router-link>
        </div>

        <p class="mt-20 text-sm text-gray-700 font-medium">
          404
        </p>

        <h1 class="mt-3 text-lg text-gray-900 font-semibold">
          Page not found
        </h1>

        <p class="mt-3 text-sm text-gray-700">
          Sorry, we couldn’t find the page you’re looking for.
        </p>

        <Button href="/" class="mt-10">
          Go back home
        </Button>
      </main>
    </div>
    <div class="hidden lg:relative lg:block sm:contents lg:flex-1">
      <img class="absolute inset-0 h-full w-full object-cover" :src="backgroundImage" alt="">
    </div>
  </div>
</template>
