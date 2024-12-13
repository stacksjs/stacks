<script setup lang="ts">
import { contributors } from './contributors'
</script>

<template>
  <div class="vp-doc">
    <h2 pb-2 pt-5 font-normal op50>
      Contributors
    </h2>
  </div>

  <div max-w-200 p-10 text-center text-lg leading-7>
    <div flex="~ wrap gap-1" justify-center>
      <a v-for="{ name, avatar } of contributors" :key="name" :href="`https://github.com/${name}`" m-0 rel="noopener noreferrer" :aria-label="`${name} on GitHub`">
        <img loading="lazy" :src="avatar" width="40" height="40" h-10 min-h-10 min-w-10 w-10 rounded-full :alt="`${name}'s avatar`">
      </a>
    </div>
    <br>
  </div>
</template>
