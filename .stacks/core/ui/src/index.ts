import * as CssEngine from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import transformerCompileClass from '@unocss/transformer-compile-class'
import * as UiEngine from 'vue'
import * as Store from 'pinia'
import options from '../../../../config/ui'
import config from './unocss'

export default {
  UiEngine,
  CssEngine,
  Store,
  presetForms,
  transformerCompileClass,
  config,
  options,
}
