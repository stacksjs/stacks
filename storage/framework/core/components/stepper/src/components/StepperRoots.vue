<script>
export default {
  name: 'VStepperRoot'
}
</script>

<style lang="scss" scoped>
.v-stepper-root {
  display: flex;
  width: inherit;
  user-select: none;
  box-sizing: border-box;
  justify-content: space-between;

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
}
</style>

<template>
	<div class="v-stepper-root">
    <slot></slot>
  </div>
</template>
