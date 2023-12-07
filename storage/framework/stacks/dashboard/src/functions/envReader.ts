import { path as p } from '@stacksjs/path'

export function useEnvReader() {
    async function read(): Promise<string> {

        const file = Bun.file(p.projectPath('./.env'));

        const output = await file.text()

        return output
    }

    return { read }
}
