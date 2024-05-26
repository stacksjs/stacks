<script lang="ts" setup>
import { ref, watch } from 'vue'
import { Stepper } from '.';

let step = ref(1);
let steps = ref(5);
const stepperRef = ref(null);

const next = () => {
  if(stepperRef.value) {
    stepperRef.value.next()
  }
}

const reset = () => {
  if(stepperRef.value) {
    stepperRef.value.reset()
  }
}

</script>

<template>
  <div class="bg-neutral-100/66 dark:bg-neutral-900 px-4 ">
    <div class="container mx-auto max-w-full sm:max-w-2xl relative">
      <Stepper ref='stepperRef' :steps="steps" v-model="step"/>
    </div>
    <!-- <button type="button" @click="next">Next</button>
    <button type="button" @click="reset">Reset</button> -->
  </div>
</template>
