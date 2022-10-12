export interface AppOptions {
  /**
   * The name of your application.
   */
  name: string

  /**
   * The application environment.
   * @default "local"
   */
  env?: 'development' | 'production' | 'local'

  /**
   * The application URL.
   * @default "http://localhost:3333"
   */
  url?: string

  /**
   * Should the application be in debug mode?
   * @default false
   */
  debug: boolean

  /**
   * What should the application port be?
   * @default number 3333
   */
  port: number

  /**
   * This application host.
   */
  host?: string

  /**
   * This key is used by the Stacks encrypter service and should be set to
   * a random, 32 character string, otherwise these encrypted strings will
   * not be safe. Please do this before deploying an application!
   */
  key?: string

  /**
   * The application's timezone.
   * @default string "UTC"
   */
  timezone?: string

  /**
   * The application's locale.
   * @default string "en"
   */
  locale?: string

  /**
   * The application's fallback locale.
   * @default string "en"
   */
  fallbackLocale: 'en'

  /**
   * The utilized IDE.
   * @default string "vscode"
   */
  editor: string

  /**
   * The cipher.
   * @default string "aes-256-cbc"
   */
  cipher: string

  // inspect: <InspectOptions>{},
}
