<script setup lang="ts">
import backgroundImage from '../../assets/images/background-call-to-action.jpg'
</script>

<template>
  <section
    id="get-started-today"
    class="relative overflow-hidden bg-blue-600 py-32"
  >
    <img
      class="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
      :src="backgroundImage"
      alt=""
    >
    <Container class="relative">
      <div class="mx-auto max-w-lg text-center">
        <h2 class="font-display text-3xl text-white tracking-tight sm:text-4xl">
          Get started today
        </h2>
        <p class="mt-4 text-lg text-white tracking-tight">
          It's time to put away the worries of later when you scale up because everything is built right out of the box. We believe your focus is to just build and grow your business.
        </p>
        <Button href="/register" variant="solid" color="white" class="mt-10">
          View Documentation
        </Button>
      </div>
    </Container>
  </section>
</template>
