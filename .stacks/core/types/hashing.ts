export interface HashingOptions {
  /**
   * This option controls the default hash driver that will be used to hash
   * passwords for your application. By default, the bcrypt algorithm is
   * used; however, you remain free to modify this option if you wish.
   */
  driver: 'argon' | 'bcrypt' | 'base64'

  /**
   * Here you may specify the configuration options that should be used when
   * passwords are hashed using the Bcrypt algorithm. This will allow you
   * to control the amount of time it takes to hash the given password.
   */
  bcrypt?: BcryptOptions

  /**
   * Here you may specify the configuration options that should be used when
   * passwords are hashed using the Argon algorithm. These will allow you
   * to control the amount of time it takes to hash the given password.
   */
  argon?: ArgonOptions
}

/**
 * Here you may specify the configuration options that should be used when
 * passwords are hashed using the Bcrypt algorithm. This will allow you
 * to control the amount of time it takes to hash the given password.
 */
export interface BcryptOptions {
  /**
   * Bcrypt salt rounds.
   * @default number 10
   */
  rounds?: number
}

/**
 * Here you may specify the configuration options that should be used when
 * passwords are hashed using the Argon algorithm. These will allow you
 * to control the amount of time it takes to hash the given password.
 */
export interface ArgonOptions {
  /**
   * Amount of memory (in kibibytes) to use.
   * @default number 65536
   */
  memory?: number

  /**
   * Degree of parallelism (i.e. number of threads).
   * @default number 1
   */
  threads?: number

  /**
   * Execution time.
   * @default number 1
   */
  time?: number
}
