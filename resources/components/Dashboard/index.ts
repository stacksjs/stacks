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

// Re-export types if needed
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
  actions?: Array<{ label: string; onClick: () => void }>
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
