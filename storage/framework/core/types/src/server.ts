export interface ServerOptions {
  type?:
    | 'frontend'
    | 'backend'
    | 'api'
    | 'library'
    | 'desktop'
    | 'docs'
    | 'email'
    | 'admin'
    | 'system-tray'
    | 'database'
  host?: string
  port?: number
  open?: boolean
}
