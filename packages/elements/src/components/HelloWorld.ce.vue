<script setup lang="ts">
import { HelloWorld } from '@ow3/hello-world-vue'
import { ref } from 'vue'

interface Props {
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: 'J. Doe',
})

// reactive state
const count = ref(0)

// functions that mutate state and trigger updates
function increment() {
  count.value++
}
</script>

<template>
  <HelloWorld :name="props.name" />
</template>

<!-- <style>
h1 {
  color: green;
}
</style> -->
