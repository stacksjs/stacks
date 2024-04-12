/**
 * The Stacks runtime provides secure Bcrypt & Argon2 hashing for storing user passwords.
 * If you are using one of the Laravel application starter kits, Bcrypt will be used for
 * registration and authentication by default.
 *
 * Bcrypt is a great choice for hashing passwords because its "work factor" is adjustable, which
 * means that the time it takes to generate a hash can be increased as hardware power increases.
 * When hashing passwords, slow is good. The longer an algorithm takes to hash a password, the
 * longer it takes malicious users to generate "rainbow tables" of all possible string hash
 * values that may be used in brute force attacks against applications.
 *
 * @see https://stacksjs.org/docs/hashing
 */
export interface HashingOptions {
  /**
   * **Hashing Driver**
   *
   * This option controls the default hash driver that will be used to hash
   * passwords for your application. By default, the bcrypt algorithm is
   * used; however, you remain free to modify this option if you wish.
   *
   * @see https://stacksjs.org/docs/hashing
   */
  driver: 'argon2' | 'argon2id' | 'argon2i' | 'argon2d' | 'bcrypt'

  /**
   * **Bcrypt Option**
   *
   * Here you may specify the configuration options that should be used when
   * passwords are hashed using the Bcrypt algorithm. This will allow you
   * to control the amount of time it takes to hash the given password.
   *
   * @see https://stacksjs.org/docs/hashing
   */
  bcrypt?: BcryptOptions

  /**
   * **Argon Options**
   *
   * Here you may specify the configuration options that should be used when
   * passwords are hashed using the Argon algorithm. These will allow you
   * to control the amount of time it takes to hash the given password.
   *
   * @see https://stacksjs.org/docs/hashing
   */
  argon2?: ArgonOptions
}

export type HashingConfig = Partial<HashingOptions>

/**
 * **Bcrypt Options**
 *
 * Here you may specify the configuration options that should be used when
 * passwords are hashed using the Bcrypt algorithm. This will allow you
 * to control the amount of time it takes to hash the given password.
 *
 * @see https://stacksjs.org/docs/hashing
 */
export interface BcryptOptions {
  /**
   * Bcrypt salt rounds.
   *
   * @default number 10
   * @see https://stacksjs.org/docs/hashing
   */
  rounds: number

  /**
   * Bcrypt cost. This is a number between 4-31.
   * @default number 4
   * @see https://stacksjs.org/docs/hashing
   */
  cost: number
}

/**
 * **Argon Options**
 *
 * Here you may specify the configuration options that should be used when
 * passwords are hashed using the Argon algorithm. These will allow you
 * to control the amount of time it takes to hash the given password.
 *
 * @see https://stacksjs.org/docs/hashing
 */
export interface ArgonOptions {
  /**
   * **Argon Memory**
   *
   * Amount of memory (in kibibytes) to use.
   *
   * @default number 65536
   * @see https://stacksjs.org/docs/hashing
   */
  memory?: number

  // /**
  //  * **Argon Parallelism**
  //  *
  //  * Degree of parallelism (i.e. number of threads).
  //  *
  //  * @default number 1
  //  * @see https://stacksjs.org/docs/hashing
  //  */
  // threads?: number

  /**
   * **Argon time**
   *
   * Execution time.
   *
   * @default number 1
   * @see https://stacksjs.org/docs/hashing
   */
  time?: number
}

export type HashAlgorithm =
  | 'md4'
  | 'md5'
  | 'sha1'
  | 'sha256'
  | 'sha384'
  | 'sha512'
  | 'ripemd128'
  | 'ripemd160'
  | 'tiger128'
  | 'tiger160'
  | 'tiger192'
  | 'crc32'
  | 'crc32b'
