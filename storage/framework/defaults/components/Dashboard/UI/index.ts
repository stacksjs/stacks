/**
 * Stacks Dashboard UI Component Library
 * ======================================
 * A modern, clean component library built with Vue 3 and Tailwind CSS.
 * Designed for use across Stacks Dashboard, HomeOS, and web demos.
 *
 * NOTE: Core primitives (Button, Card, Modal) are migrating to @stacksjs/stx-ui.
 * These components are still available here for backward compatibility but
 * new code should import from '@stacksjs/stx-ui/vue' when available.
 */

// Core Primitives (legacy - consider using @stacksjs/stx-ui for new code)
export { default as Button } from './Button.vue'
export { default as Input } from './Input.vue'
export { default as Card } from './Card.vue'
export { default as Badge } from './Badge.vue'
export { default as Avatar } from './Avatar.vue'

// Form Components
export { default as Select } from './Select.vue'
export { default as Checkbox } from './Checkbox.vue'
export { default as Toggle } from './Toggle.vue'
export { default as Textarea } from './Textarea.vue'

// Dropdown
export { default as Dropdown } from './Dropdown.vue'
export { default as DropdownItem } from './DropdownItem.vue'

// Overlays
export { default as Modal } from './Modal.vue'

// Dashboard Specific
export { default as StatsCard } from './StatsCard.vue'

// Navigation
export { default as Tabs } from './Tabs.vue'

// Data Display
export { default as Table } from './Table.vue'
export { default as Pagination } from './Pagination.vue'

// Page Components
export { default as PageHeader } from './PageHeader.vue'
export { default as EmptyState } from './EmptyState.vue'

// Window Controls
export { default as WindowControls } from './WindowControls.vue'

// Re-export stx-ui components for gradual migration
// export {
//   StxButton,
//   StxCard,
//   StxModal,
// } from '@stacksjs/stx-ui/vue'
//
// Re-export composables
// export {
//   useDarkMode,
//   useMediaQuery,
//   useModal,
//   useClipboard,
//   useLocalStorage,
// } from '@stacksjs/stx-ui/composables'
