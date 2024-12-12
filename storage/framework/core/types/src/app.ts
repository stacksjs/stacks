export type AppEnvType = 'local' | 'dev' | 'stage' | 'prod' | 'testing' | string

/**
 * **Application Options**
 *
 * This configuration defines all of your application options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface AppOptions {
  /**
   * **Application Name**
   *
   * This value is the name of your application. This value is used when the
   * framework needs to place the application's name in a log or any
   * other location as required by the application or its packages.
   *
   * @default string "Stacks"
   */
  name: string

  /**
   * **Application Description**
   *
   * This value is the description of your application. This value is used when the
   * framework generates meta tags for the frontend.
   */
  description: string

  /**
   * **Application Environment**
   *
   * This value determines the "environment" your application is currently
   * running in. This may determine how you prefer to configure various
   * services the application utilizes. Set this in your ".env" file
   *
   * @default "local"
   */
  env: AppEnvType

  /**
   * **Application URL**
   *
   * This URL is used by the console to properly generate URLs when using
   * the Buddy command line tool. You should set this to the root of
   * your application so that it is used when running Buddy tasks.
   *
   * @default string "stacks.localhost"
   * @example "my-project.test"
   */
  url: string

  /**
   * **Redirect URLs**
   *
   * A Redirect URL is a URL that permanently redirects to the Application URL.
   * This is useful for when you have multiple domains that you want to redirect
   * to your application. You can set this to a string or an array of strings.
   *
   * @default []
   * @example "['stacksjs.com', 'stacksjs.dev']"
   */
  redirectUrls: string | string[]

  /**
   * **Application Debug Mode**
   *
   * When your application is in debug mode, detailed error messages with
   * stack traces will be shown on every error that occurs within your
   * application. If disabled, a simple generic error page is shown.
   *
   * @default true
   */
  debug: boolean

  /**
   * **Maintenance Mode**
   *
   * When your application is in maintenance mode, a simple maintenance
   * page will be shown on every request into your application.
   *
   * @default false
   */
  maintenanceMode: boolean

  /**
   * **Encryption Key**
   *
   * This key is used by the Stacks encrypter service and should be set to
   * a random, 32 character string, otherwise these encrypted strings will
   * not be safe. Please do this before deploying an application!
   */
  key: string

  /**
   * **Application Timezone**
   *
   * Here you may specify the default timezone for your application, which
   * will be used by Stacks and date-time functions. We have gone ahead
   * and set this to a sensible default for you out of the box.
   *
   * @default string "UTC"
   */
  timezone: string

  /**
   * **Application Locale Configuration**
   *
   * The application locale determines the default locale that will be used
   * by the translation service provider. You are free to set this value
   * to any of the locales which will be supported by the application.
   *
   * @default string "en"
   * @example
   * de // ./lang/de.yml needs to be present for this
   */
  locale: string

  /**
   * **Application Fallback Locale**
   *
   * The fallback locale determines the locale to use when the current one
   * is not available. You may change the value to correspond to any of
   * the language folders that are provided through your application.
   *
   * @default string "en"
   */
  fallbackLocale: 'en'

  /**
   * **Cipher**
   *
   * Description WIP.
   *
   * @default string "aes-256-cbc"
   */
  cipher: string

  // inspect: <InspectOptions>{},

  /**
   * **Documentation Mode**
   *
   * $appUrl becomes your Documentation URL.
   *
   * @default false
   */
  docMode: boolean
}

export type AppConfig = Partial<AppOptions>
