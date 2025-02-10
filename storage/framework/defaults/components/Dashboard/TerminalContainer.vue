<script setup>
defineProps({
  live: Boolean,
})
</script>

<template>
  <div class="">
    <div class="h-full w-full flex flex-col rounded-lg bg-[#1D1F21] text-[#C5C8C6] font-mono shadow">
      <header class="flex items-center justify-between border-b border-[#282a2e] rounded-t-lg bg-[#373b41] p-4">
        <div class="flex items-center gap-2">
          <div class="h-3 w-3 rounded-full bg-[#CC6666]" />
          <div class="h-3 w-3 rounded-full bg-[#E6E074]" />
          <div class="h-3 w-3 rounded-full bg-[#68B5BD]" />
        </div>

        <div v-if="live" class="text-sm">
          Live Terminal Output
        </div>
        <div v-else class="text-sm">
          root@localhost:~
        </div>
      </header>

      <div class="h-54 w-full overflow-auto p-4">
        <div class="text-sm leading-7">
          <p class="text-[#68B5BD]">
            root@localhost:~$ ls
          </p>
          <p>Desktop Documents Downloads Music Pictures Public Templates Videos</p>
          <p class="pt-2 text-[#68B5BD]">
            root@localhost:~$ pwd
          </p>
          <p>/home/root</p>
          <p class="pt-2 text-[#68B5BD]">
            root@localhost:~$ whoami
          </p>
          <p>root</p>
        </div>
      </div>

      <div v-if="!live" class="flex items-center gap-2 border-t border-[#282a2e] p-4">
        <span class="text-[#68B5BD]">root@localhost:~$</span>
        <input
          class="w-full bg-[#1D1F21] text-[#C5C8C6] focus:outline-none"
          placeholder="Type your command..."
          type="text"
        >
        <button class="rounded bg-[#68B5BD] px-4 py-2 text-[#1D1F21]">
          Run
        </button>
      </div>
    </div>
  </div>
</template>
