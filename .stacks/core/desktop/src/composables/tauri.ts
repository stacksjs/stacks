import { open } from '@tauri-apps/api/shell'

export const openWindow = (link: string) => {
  const win: any = window

  if (win.__TAURI_METADATA__) {
    open(link)
  }
  else {
    window.open(
      link,
      '_blank', // <- This is what makes it open in a new window.
    )
  }
}
