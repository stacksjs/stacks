/*
|--------------------------------------------------------------------------
| Default Hash Driver
|--------------------------------------------------------------------------
|
| This option controls the default hash driver that will be used to hash
| passwords for your application. By default, the bcrypt algorithm is
| used; however, you remain free to modify this option if you wish.
|
| Supported: "bcrypt", "argon"
|
*/

const driver = 'bcrypt'

/*
|--------------------------------------------------------------------------
| Bcrypt Options
|--------------------------------------------------------------------------
|
| Here you may specify the configuration options that should be used when
| passwords are hashed using the Bcrypt algorithm. This will allow you
| to control the amount of time it takes to hash the given password.
|
*/

const bcrypt = {
  rounds: 10,
}

/*
|--------------------------------------------------------------------------
| Argon Options
|--------------------------------------------------------------------------
|
| Here you may specify the configuration options that should be used when
| passwords are hashed using the Argon algorithm. These will allow you
| to control the amount of time it takes to hash the given password.
|
*/
// const argon = {
//   memory: 65536, // default to env.ARGON_MEMORY
//   threads: 1, // default to env.ARGON_THREADS
//   time: 1, // default to env.ARGON_TIME
// }

export { driver, bcrypt }
