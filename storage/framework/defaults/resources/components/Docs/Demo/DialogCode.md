```vue
<!-- App.vue -->
<script lang="ts" setup>
import { Dialog, DialogPanel } from '@stacksjs/dialog'

const visible = ref(false)

const handleClose = () => {
  visible.value = false
}
</script>

<template>
  <Transition name="fade" appear>
    <Dialog v-if="visible" @close="handleClose">

      <Transition name="fade" appear>
        <DialogPanel as="div">
          <h2>Greetings! This is a dialog.</h2>
        </DialogPanel>
      </Transition>
    </Dialog>
  </Transition>

  <button @click="visible = true">
    Open Dialog
  </button>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity .4s linear;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

```
