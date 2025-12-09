/**
 * STX-UI Vue Components
 * Vue wrappers for the stx-ui web components.
 */

export { default as StxButton } from './StxButton.vue'
export { default as StxCard } from './StxCard.vue'
export { default as StxModal } from './StxModal.vue'

// Re-export types from web components
export type {
  ButtonVariant,
  ButtonSize,
  StxButtonAttributes,
  CardVariant,
  CardPadding,
  CardRounded,
  StxCardAttributes,
  ModalSize,
  StxModalAttributes,
} from '../web-components'
