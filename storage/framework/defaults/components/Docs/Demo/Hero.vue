<script lang="ts" setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="dropdownWrapper">
      <div class="toast" />
      <div class="toast" />
      <div class="toast" />
    </div>
    <h1 class="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-700 dark:to-blue-300 mb-3 text-5xl font-bold -mt-5">
      {{ title }}
    </h1>
    <p class="mb-3 mt-0 text-lg">
      {{ description }}
    </p>

    <a
      class="button btn-secondary"
      :href="link"
      target="_blank"
    >
      Github
    </a>
  </div>
</template>

<style scoped>
.dropdownWrapper {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  width: 400px;
  height: 100px;
  width: 400px;
  position: relative;
  -webkit-mask-image: linear-gradient(to top, transparent 0%, black 35%);
  mask-image: linear-gradient(to top, transparent 0%, black 35%);
  opacity: 1;
}

.toast {
  width: 356px;
  height: 40px;
  background: #ffffff;
  box-shadow: 0 4px 12px #00000068;
  border: 1px solid #f5f5f5;
  border-radius: 6px;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.toast:nth-child(1) {
  transform: translateY(-60%) translateX(-50%) scale(0.9);
}

.toast:nth-child(2) {
  transform: translateY(-30%) translateX(-50%) scale(0.95);
}

.button {
  height: 40px;
  border-radius: 6px;
  border: none;
  padding: 0 30px;
  font-weight: 600;
  flex-shrink: 0;
  font-family: inherit;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 0px 0px rgba(0, 0, 0, 0.08), 0px 2px 2px 0px rgba(0, 0, 0, 0.04),
    0px 3px 3px 0px rgba(0, 0, 0, 0.02), 0px 4px 4px 0px rgba(0, 0, 0, 0.01);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  text-decoration: none;
  color: hsl(0, 0%, 9%);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  transition: box-shadow 200ms, background 200ms;
}

.btn-secondary {
  background: linear-gradient(
    156deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(240, 240, 240, 1) 100%
  );
}

.button:focus-visible {
  outline: none;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 0px 0px rgba(0, 0, 0, 0.08), 0px 2px 2px 0px rgba(0, 0, 0, 0.04),
    0px 3px 3px 0px rgba(0, 0, 0, 0.02), 0px 4px 4px 0px rgba(0, 0, 0, 0.01),
    0 0 0 2px rgba(0, 0, 0, 0.15);
}

.button:after {
  content: '';
  position: absolute;
  top: 100%;
  background: blue;
  left: 0;
  width: 100%;
  height: 35%;
  background: linear-gradient(
    to top,
    hsl(0, 0%, 91%) 0%,
    hsla(0, 0%, 91%, 0.987) 8.1%,
    hsla(0, 0%, 91%, 0.951) 15.5%,
    hsla(0, 0%, 91%, 0.896) 22.5%,
    hsla(0, 0%, 91%, 0.825) 29%,
    hsla(0, 0%, 91%, 0.741) 35.3%,
    hsla(0, 0%, 91%, 0.648) 41.2%,
    hsla(0, 0%, 91%, 0.55) 47.1%,
    hsla(0, 0%, 91%, 0.45) 52.9%,
    hsla(0, 0%, 91%, 0.352) 58.8%,
    hsla(0, 0%, 91%, 0.259) 64.7%,
    hsla(0, 0%, 91%, 0.175) 71%,
    hsla(0, 0%, 91%, 0.104) 77.5%,
    hsla(0, 0%, 91%, 0.049) 84.5%,
    hsla(0, 0%, 91%, 0.013) 91.9%,
    hsla(0, 0%, 91%, 0) 100%
  );
  opacity: 0.6;
  transition: transform 200ms;
}

.btn-secondary:hover:after {
  transform: translateY(-100%);
}

@media (max-width: 600px) {
  .dropdownWrapper {
    width: 100%;
  }
}
</style>
