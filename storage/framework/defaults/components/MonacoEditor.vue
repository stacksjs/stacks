<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  modelValue: string
  language?: string
  theme?: string
  options?: monaco.editor.IStandaloneEditorConstructionOptions
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language || 'typescript',
    theme: props.theme || 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    ...props.options,
  })

  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor?.getValue() || '')
  })
})

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose()
  }
})

watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
  }
})

watch(() => props.language, (newValue) => {
  if (editor) {
    monaco.editor.setModelLanguage(editor.getModel()!, newValue || 'typescript')
  }
})

watch(() => props.theme, (newValue) => {
  if (editor) {
    monaco.editor.setTheme(newValue || 'vs-dark')
  }
})

watch(() => props.options, (newValue) => {
  if (editor) {
    editor.updateOptions(newValue || {})
  }
}, { deep: true })
</script>

<template>
  <div ref="editorContainer" class="w-full h-full" />
</template>
