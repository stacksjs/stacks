<script setup lang="ts">
import { VAceEditor } from 'vue3-ace-editor'
import '../../../config/ace-config'

defineProps({
  live: Boolean,
})

// import OutlineTree from './OutlineTree.vue';

// const langs = ['json', 'javascript', 'typescript', 'sh', 'html', 'yaml', 'markdown']
// const themes = ['github', 'github_dark', 'chrome', 'monokai', 'nord_dark']

const options = reactive({
  lang: 'typescript',
  theme: 'github_dark',
  content: `echo 'Hello World!'

mv ./test/test.ts ./jello
cp`,
})
</script>

<template>
  <header class="flex items-center justify-between border-b border-[#30363d] rounded-t-lg bg-[#1f2428] p-4">
    <div class="flex items-center gap-2">
      <div class="h-3 w-3 rounded-full bg-[#f85149]" />
      <div class="h-3 w-3 rounded-full bg-[#db9d16]" />
      <div class="h-3 w-3 rounded-full bg-[#2ea043]" />
    </div>

    <span v-if="!live" class="text-sm text-[#c9d1d9] font-mono">Deploy Script</span>
    <span v-else class="text-sm text-[#c9d1d9] font-mono">Live Terminal Output</span>
  </header>

  <VAceEditor
    v-model:value="options.content"
    class="vue-ace-editor rounded-b-lg bg-[#0d1117]"
    :placeholder="`Enter your ${options.lang} code here`"
    :lang="options.lang"
    :theme="options.theme"
    :options="{
      useWorker: true,
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true,
      fontSize: '14px',
      fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
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
  font-size: 14px;
  flex: 1;
}

/* .outline-tree {
  width: 500px;
  margin-left: 15px;
  border: 1px solid;
  font-size: 16px;
} */
</style>
