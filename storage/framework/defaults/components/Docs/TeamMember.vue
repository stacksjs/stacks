<script setup lang="ts">
import type { CoreTeam } from '../../../docs/contributors'

defineProps<{
  data: CoreTeam
}>()
</script>

<template>
  <div text-center>
    <img
      loading="lazy"
      width="100" height="100" m-auto h-25 min-h-25 min-w-25 w-25 rounded-full
      :src="data.avatar"
      :alt="`${data.name}'s avatar`"
    >
    <div mb-1 mt-2 text-xl>
      {{ data.name }}
    </div>
    <div h-80px op60 v-html="data.description" />

    <div flex="~ inline gap-2" py2 text-2xl>
      <a
        class="i-carbon-logo-github mya inline-block text-current op30 transition duration-200 hover:op100"
        :href="`https://github.com/${data.github}`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`${data.name} on GitHub`"
      />

      <a
        v-if="data.sponsors"
        class="i-carbon-favorite-filled mya inline-block text-current op30 transition duration-200 hover:op100"
        :href="`https://github.com/sponsors/${data.github}`"
        target="_blank"
        rel="noopener noreferrer"
        :title="`Sponsor ${data.name}`"
        :aria-label="`Sponsor ${data.name}`"
      />
    </div>

    <div v-if="data.functions || data.packages" grid="~ cols-[20px_1fr] gap-x-1 gap-y-2" w="5/6" mxa mb2 items-start rounded bg-gray:5 p3>
      <template v-if="data.functions">
        <div i-carbon:function-math ma op50 title="Functions" />
        <div flex="~ row wrap gap-2" text-left text-sm>
          <a v-for="f of data.functions" :key="f" :href="`/${f}`" target="_blank">
            <code>{{ f }}</code>
          </a>
        </div>
      </template>

      <template v-if="data.packages">
        <div i-carbon-cube ma op50 title="Packages" />
        <div flex="~ row wrap gap-2" text-left text-sm>
          <a v-for="f of data.packages" :key="f" href="/add-ons">
            <code>{{ f }}</code>
          </a>
        </div>
      </template>
    </div>
  </div>
</template>
