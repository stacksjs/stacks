<script lang="ts">
import { HelloWorld } from '@ow3/hello-world-vue'

interface Props {
  name?: string
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<Props>(), {
  name: 'J. Doe',
})
</script>

<template>
  <HelloWorld :name="props.name" />
</template>
