<template>
	<div class="v-stepper-root">
    <slot>s</slot>
  </div>
</template>

<script>
export default {
  name: 'Stepper'
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
