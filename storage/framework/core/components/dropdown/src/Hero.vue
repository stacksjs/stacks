<script lang="ts" setup>
import { Dropdown, DropdownButton, DropdownItem, DropdownItems } from './'
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="dropdownWrapper">
      <div class="toast" />
      <div class="toast" />
      <div class="toast" />
    </div>
    <h1 class="text-neon mb-3 text-5xl font-bold -mt-5">
      stacks/dropdown
    </h1>
    <p class="mb-3 mt-0 text-lg">
      An opinionated dropdown component for Stacks.
    </p>
    <div class="flex gap-2">
      <Dropdown as="div" class="relative z-10 inline-block text-left">
        <div>
          <DropdownButton
            class="btn-primary w-full inline-flex justify-center rounded-md px-4 py-2.5 text-sm text-white font-medium focus:outline-none focus-visible:ring-2"
          >
            Dropdown <div class="i-hugeicons-chevron-down-20-solid ml-2 h-5 w-5" />
          </DropdownButton>
        </div>

        <transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <DropdownItems
            class="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 divide-y divide-gray-100 focus:outline-none"
          >
            <div class="px-1 py-1">
              <DropdownItem v-slot="{ active }">
                <button
                  class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                    active ? 'bg-violet-500 text-white' : 'text-gray-900',
                  ]"
                >
                  <div class="i-hugeicons-pencil-20-solid mr-2 h-5 w-5" />
                  Edit
                </button>
              </DropdownItem>
              <DropdownItem v-slot="{ active }">
                <button
                  class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                    active ? 'bg-violet-500 text-white' : 'text-gray-900',
                  ]"
                >
                  <div class="i-hugeicons:copy-01-20-solid" />
                  Duplicate
                </button>
              </DropdownItem>
            </div>
            <div class="px-1 py-1">
              <DropdownItem v-slot="{ active }">
                <button
                  class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                    active ? 'bg-violet-500 text-white' : 'text-gray-900',
                  ]"
                >
                  <div class="i-hugeicons-archive-box-20-solid mr-2 h-5 w-5" />
                  Archive
                </button>
              </DropdownItem>
              <DropdownItem v-slot="{ active }">
                <button
                  class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                    active ? 'bg-violet-500 text-white' : 'text-gray-900',
                  ]"
                >
                  <div class="i-hugeicons-arrow-path-20-solid mr-2 h-5 w-5" />
                  Move
                </button>
              </DropdownItem>
            </div>

            <div class="px-1 py-1">
              <DropdownItem v-slot="{ active }">
                <button
                  class="group w-full flex items-center rounded-md px-2 py-2 text-sm" :class="[
                    active ? 'bg-violet-500 text-white' : 'text-gray-900',
                  ]"
                >
                  <div class="i-hugeicons-trash-20-solid mr-2 h-5 w-5" />
                  Delete
                </button>
              </DropdownItem>
            </div>
          </DropdownItems>
        </transition>
      </Dropdown>
      <a
        class="button btn-secondary"
        href="https://github.com/stacksjs/stacks/tree/main/storage/framework/core/components/dropdown"
        target="_blank"
      >
        GitHub
      </a>
    </div>
  </div>
</template>

<style scoped>
.dropdownWrapper {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
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
  box-shadow: 0 4px 12px #0000001a;
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
