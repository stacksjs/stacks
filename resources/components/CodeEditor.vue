<script setup lang="ts">
import { VAceEditor } from 'vue3-ace-editor'
import './ace-config'

defineProps({
  live: Boolean,
})

// import OutlineTree from './OutlineTree.vue';

// const langs = ['json', 'javascript', 'typescript', 'sh', 'html', 'yaml', 'markdown']
// const themes = ['github', 'github_dark', 'chrome', 'monokai', 'nord_dark']

const states = reactive({
  lang: 'typescript',
  theme: 'nord_dark',
  content: `echo 'Hello World!'

mv ./test/test.ts ./jello
cp`,
})
</script>

<template>
  <header class="flex items-center justify-between p-4 bg-[#373b41] border-b border-[#282a2e] rounded-t-lg">
    <div class="flex items-center gap-2">
      <div class="w-3 h-3 rounded-full bg-[#CC6666]" />
      <div class="w-3 h-3 rounded-full bg-[#E6E074]" />
      <div class="w-3 h-3 rounded-full bg-[#68B5BD]" />
    </div>

    <span v-if="!live" class="text-sm text-white font-mono">Deploy Script</span>
    <span v-else class="text-sm text-white font-mono">Live Terminal Output</span>
  </header>

  <VAceEditor
    v-model:value="states.content"
    class="vue-ace-editor rounded-b-lg"
    :placeholder="`Enter your ${states.lang} code here`"
    :lang="states.lang"
    :theme="states.theme"
    :options="{
      useWorker: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true,
    }"
    style="height: 300px"
  />

  <!-- <OutlineTree v-if="$refs.aceRef" class="outline-tree" :editor="$refs.aceRef._editor" :content="states.content" /> -->
</template>

<style scoped>
select {
  margin-right: 15px;
}

.vue-ace-editor {
  font-size: 16px;
  flex: 1;
}

/* .outline-tree {
  width: 500px;
  margin-left: 15px;
  border: 1px solid;
  font-size: 16px;
} */
</style>
