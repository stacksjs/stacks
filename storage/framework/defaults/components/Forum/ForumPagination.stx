<template>
  <div class="flex items-center justify-center mt-8">
    <nav class="flex items-center gap-1">
      <a
        href="#"
        class="w-10 h-10 flex items-center justify-center rounded-md border hover:bg-gray-100"
        :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
      >
        <span class="i-hugeicons-arrow-left"></span>
      </a>

      <template v-for="page in totalPages" :key="page">
        <a
          href="#"
          class="w-10 h-10 flex items-center justify-center rounded-md"
          :class="currentPage === page ? 'bg-primary text-white' : 'border hover:bg-gray-100'"
        >
          {{ page }}
        </a>
      </template>

      <a
        href="#"
        class="w-10 h-10 flex items-center justify-center rounded-md border hover:bg-gray-100"
        :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
      >
        <span class="i-hugeicons-arrow-right"></span>
      </a>
    </nav>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentPage: number
  totalPages: number
}>()
</script>