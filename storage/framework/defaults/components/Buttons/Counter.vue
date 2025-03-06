<script lang="ts" setup>
const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <div>
    <button
      type="button"
      class="bg-blue-500 text-xs text-white btn hover:bg-blue-600"
      @click="increment"
    >
      <i
        class="i-hugeicons-outline-plus mr-3 h-4 w-4 -ml-1"
        aria-hidden="true"
      />
      Counter: {{ count }}
    </button>
  </div>
</template>
