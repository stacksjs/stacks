import {dirname} from "@stacksjs/path";
import {fileURLToPath} from "node:url";
import {fs} from "@stacksjs/storage/index";

export const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

export function updateConfigFile(filePath: string, newConfig: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;

    for (const key in newConfig) {
      config[key] = newConfig[key];
    }

    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));

    resolve();
  })
}
