<script lang="ts" setup>
// import { notification } from '../'
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <h1 class="text-neon mb-3 text-5xl font-bold -mt-5">
      stacks/modal
    </h1>

    <p class="mb-3 mt-0 text-lg">
      An opinionated modal component.
    </p>

    <div class="flex gap-2">
      <button
        class="button btn-primary"
        @click="
          () => {
            // notification('stacks/notification', {
            //   description: 'An opinionated toast component for Stacks.',
            // })
          }
        "
      >
        Render a Modal
      </button>
      <a
        class="button btn-secondary"
        href="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/notification"
        target="_blank"
      >
        GitHub
      </a>
    </div>
  </div>
</template>

<style scoped>
</style>
