import { page as config } from '@stacksjs/config'
import { filesystem } from '@stacksjs/storage'

const { fs } = filesystem

function generateSettings() {
  config.settings.pages.forEach((page: string) => {
    fs.appendFile(
      `${config.settings.path}/${page}.vue`,
      '',
      (err) => {
        if (err) throw err;
        console.log(`${page}.vue was appended successfully!`);
      }
    );
  });
}

function generateOnboarding() {
  config.onboarding.pages.forEach((page: string) => {
    fs.appendFile(
      `${config.onboarding.path}/${page}.vue`,
      '',
      (err) => {
        if (err) throw err;
        console.log(`${page}.vue was appended successfully!`);
      }
    );
  })
}

export {
  generateSettings,
  generateOnboarding,
}
