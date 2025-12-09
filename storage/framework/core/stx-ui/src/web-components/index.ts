/**
 * STX-UI Web Components
 * Framework-agnostic UI primitives built with web standards.
 */

export { StxButton } from './stx-button'
export type { ButtonVariant, ButtonSize, StxButtonAttributes } from './stx-button'

export { StxCard } from './stx-card'
export type { CardVariant, CardPadding, CardRounded, StxCardAttributes } from './stx-card'

export { StxModal } from './stx-modal'
export type { ModalSize, StxModalAttributes } from './stx-modal'

// Auto-register all components when this module is imported
import './stx-button'
import './stx-card'
import './stx-modal'
