import { defineConfig, presetAttributify, presetIcons, presetUno, presetWebFonts, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons(),
    presetAttributify(),
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Roboto:300,400,500,600,700',
      },
    }),
  ],

  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  theme: {
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
      },
      error: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
      },
      gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
      },
    },
  },

  shortcuts: [
    {
      'flex-center': 'flex justify-center items-center',
      'flex-col-center': 'flex flex-col justify-center items-center',
      'flex-between': 'flex justify-between items-center',
      'text-neon': 'text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-blue-700 dark:to-blue-300',
      'text-primary': 'text-neutral-600 dark:text-neutral-50',
      'btn-primary': '!text-neutral-50 bg-blue-600 !shadow hover:bg-blue-500',
      'btn-default': 'py-2 px-3 m-0 whitespace-nowrap bg-neutral-50/80 border border-neutral-200/80 font-semibold cursor-pointer rounded-md text-xs hover:bg-neutral-200/50 hover:border-neutral-400/50',
      'btn-border': 'py-2 px-3 m-0 whitespace-nowrap bg-transparent border border-neutral-200 font-semibold cursor-pointer rounded-md text-xs hover:bg-neutral-200/50 hover:border-neutral-400/50',
    },
  ],

  rules: [
    ['stepper-line', { height: '2px', transition: 'all 0.3s ease' }],
    ['stepper-dot', { width: '10px', height: '10px', borderRadius: '50%' }],
  ],

  safelist: [
    'text-primary-600',
    'text-error-600',
    'text-gray-400',
    'text-gray-500',
    'text-gray-600',
    'text-gray-900',
    'bg-primary-100',
    'bg-primary-600',
    'bg-error-50',
    'bg-error-600',
    'bg-gray-50',
    'bg-gray-100',
    'bg-gray-200',
    'i-heroicons-check',
    'i-heroicons-user',
    'i-heroicons-identification',
    'i-heroicons-document-text',
    'i-heroicons-check-badge',
    'i-heroicons-1-circle',
    'i-heroicons-2-circle',
    'i-heroicons-3-circle',
    'i-heroicons-4-circle',
    'i-heroicons-5-circle',
  ],
})
