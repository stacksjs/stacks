<script lang="ts" setup>
import { ref } from 'vue'
import { Stepper } from '.';

let step = ref(1);
let steps = ref(5);

</script>

<template>
  <div class="bg-neutral-100/66 dark:bg-neutral-900 px-4 ">
    <div class="container mx-auto max-w-full sm:max-w-2xl relative">
      <Stepper ref='stepper' :steps="steps" v-model="step"/>
    </div>
  </div>
</template>
