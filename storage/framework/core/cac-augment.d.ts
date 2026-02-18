// This file must be a module (have export/import) for declare module to augment
// rather than replace the existing cac types.
export {}

declare module 'cac' {
  interface CAC {
    isForce: boolean
    isNoInteraction: boolean
  }
}
