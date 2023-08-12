export interface StorageOptions {
  /**
   * **Storage Driver**
   *
   * The storage driver to utilize.
   *
   * @default string 's3'
   * @see https://stacksjs.dev/docs/storage
   */
  driver: 's3' | 'local'

  /**
   * **Storage Name**
   *
   * The name of the storage bucket.
   *
   * @default string `${app.url}-${region}-${accountId}`
   * @see https://stacksjs.dev/docs/storage
   */
  name: string
}

export type StorageConfig = StorageOptions
