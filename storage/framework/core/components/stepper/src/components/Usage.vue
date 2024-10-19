<script lang="ts" setup>
import { ref } from 'vue'

import { useCopyCode } from '../composables/useCopyCode'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

const code = `<!-- App.vue -->
<script lang="ts" setup>
import { Stepper } from '@stacksjs/stepper'

const step = ref(1)
const steps = ref(5)
const stepperRef = ref(null)

<\/script>

<template>
  <!-- Stepper -->
  <Stepper ref="stepperRef" v-model="step" :steps="steps" />

  <!-- Template for each step -->
  <template v-if="step === 1"><!-- Step 1 Content --></template>
  <template v-if="step === 2"><!-- Step 2 Content --></template>
  <template v-if="step === 3"><!-- Step 3 Content --></template>

  <!-- Stepper Controls -->
  <button type="button" @click="stepperRef?.previous()">Previous</button>
  <button type="button" @click="stepperRef?.next()">Next</button>
  <button type="button" @click="stepperRef?.reset()">Reset</button>

</template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
}
</script>

<template>
  <div class="usage">
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      To use the component in your templates, simply import and register with your component. To control the Stepper state, we use the v-model directive, just like on any other input element with two-way binding. The Stepper acts as a group of radio-buttons.
    </p>
    <div class="group code-block relative">
      <Highlight
        class-name="hightlight-rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <CheckIcon v-if="showCheckIcon" />
        <CopyIcon v-else />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* @unocss-placeholder  */
</style>
