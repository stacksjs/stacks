<script lang="ts" setup>
import { ref } from 'vue'
import Dialog from './components/Dialog.vue'
import DialogPanel from './components/DialogPanel.vue'

const visible = ref(false)

function handleOpen() {
  visible.value = true
}

function handleClose() {
  visible.value = false
}

</script>

<template >
  <div>
    <button
      class="button btn-primary"
      @click="handleOpen"
    >
      Render Dialog
    </button>

    <Transition name="fade" appear>
      <Dialog v-if="visible" @close="handleClose">
        <DialogPanel>
          <h2>Greetings! This is a dialog.</h2>
        </DialogPanel>
      </Dialog>
    </Transition>
  </div>
</template>

<style scoped>
/* @unocss-placeholder */
</style>
