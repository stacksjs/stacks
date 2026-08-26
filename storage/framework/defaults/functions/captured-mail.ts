import { dashboardApi } from './dashboard-api'

export interface CapturedMailSummary {
  id: string
  source: 'memory' | 'disk'
  from: string
  to: string
  cc: string
  bcc: string
  subject: string
  preview: string
  sentAt: string
  hasHtml: boolean
  hasText: boolean
  size: number
}

export interface CapturedMailMessage extends CapturedMailSummary {
  html: string
  text: string
}

export interface CapturedMailProblem {
  /** The capture that could not be read: a disk filename, or `mem:<index>`. */
  capture: string
  reason: string
}

export interface CapturedMailIndex {
  captureDriver: 'log'
  activeDriver: string
  total: number
  messages: CapturedMailSummary[]
  /** How many captures were skipped because they could not be parsed. */
  unreadable: number
  problems: CapturedMailProblem[]
}

export async function fetchCapturedMail(): Promise<CapturedMailIndex> {
  return dashboardApi<CapturedMailIndex>('/api/dashboard/email/captured')
}

export async function fetchCapturedMailMessage(id: string): Promise<CapturedMailMessage> {
  const result = await dashboardApi<{ message: CapturedMailMessage }>(
    `/api/dashboard/email/captured/${encodeURIComponent(id)}`,
  )
  return result.message
}
