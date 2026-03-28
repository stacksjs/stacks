/**
 * Dashboard Components
 *
 * Export all custom dashboard components for easy importing.
 *
 * Usage:
 * import { Widget, Card, Table, Chart } from '@/components/Dashboard'
 */

export { default as Widget } from './Widget.stx'
export { default as Card } from './Card.stx'
export { default as Table } from './Table.stx'
export { default as Chart } from './Chart.stx'

// UI Components
export { default as Badge } from './UI/Badge.stx'
export { default as Button } from './UI/Button.stx'
export { default as Input } from './UI/Input.stx'
export { default as Select } from './UI/Select.stx'
export { default as Modal } from './UI/Modal.stx'
export { default as Tabs } from './UI/Tabs.stx'
export { default as Pagination } from './UI/Pagination.stx'
export { default as StatsCard } from './UI/StatsCard.stx'
export { default as PageHeader } from './UI/PageHeader.stx'
export { default as EmptyState } from './UI/EmptyState.stx'
export { default as FilterBar } from './UI/FilterBar.stx'
export { default as DataTable } from './UI/DataTable.stx'
export { default as ChartCard } from './UI/ChartCard.stx'
export { default as ConfirmDialog } from './UI/ConfirmDialog.stx'
export { default as ActivityTable } from './UI/ActivityTable.stx'
export { default as ServiceHealth } from './UI/ServiceHealth.stx'
export { default as QuickLinks } from './UI/QuickLinks.stx'

// Re-export types
export interface WidgetProps {
  title: string
  value: string
  description?: string
  trend?: string
  icon?: string
}

export interface CardProps {
  title?: string
  subtitle?: string
  actions?: Array<{ label: string, onClick: () => void }>
  padding?: boolean
}

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  render?: (value: any, row: any) => string
}

export interface TableProps {
  columns: TableColumn[]
  data: any[]
  striped?: boolean
  hoverable?: boolean
}

export interface ChartProps {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area'
  data: object
  options?: object
  height?: string
}

export interface StatsCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: number
  trendLabel?: string
  icon?: string
  iconBg?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  loading?: boolean
}

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  rounded?: 'default' | 'full'
  outline?: boolean
  dot?: boolean
  text?: string
}

export interface FilterBarProps {
  searchPlaceholder?: string
  searchValue?: string
  showItemsPerPage?: boolean
  itemsPerPage?: number
  itemsPerPageOptions?: number[]
}

export interface ConfirmDialogProps {
  isOpen?: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
}
