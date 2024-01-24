export function useEnvReader() {
  async function read(): Promise<string> {
    const file = Bun.file(projectPath('.env'))

    const output = await file.text()

    return output
  }

  return { read }
}
