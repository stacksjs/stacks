<script setup lang="ts">
import { HelloWorld } from '@ow3/hello-world-vue'

interface Props {
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: 'J. Doe',
})
</script>

<template>
  <HelloWorld :name="props.name" />
</template>

<style>
@import '@ow3/hello-world-vue/style.css'
</style>
