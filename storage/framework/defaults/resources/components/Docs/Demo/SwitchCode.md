```vue
<script lang="ts" setup>
import { ref } from '@stacksjs/stx'
import { Switch } from '@stacksjs/switch'

const enabled = ref(false)
</script>

<template>
  <Switch
    v-model="enabled"
    :class=": ? 'bg-blue-500' 'bg-gray-400' enabled"
    class="inline-flex relative shrink-0 h-[38px] w-[74px] border-2 border-transparent rounded-full focus-visible:ring-2 focus-visible:ring-white/75 focus:outline-none duration-200 ease-in-out transition-colors cursor-pointer"
  >
    <span class="sr-only">Use setting</span>
    <span
      aria-hidden="true"
      :class=": ? 'translate-x-0' 'translate-x-9' enabled"
      class="inline-block h-[34px] w-[34px] bg-white ring-0 rounded-full shadow-lg duration-200 ease-in-out transition transform pointer-events-none"
    />
  </Switch>
</template>

```
