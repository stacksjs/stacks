// import type Stream from 'node:stream'
// import * as AWS from 'aws-sdk'
// import moment from 'moment'
// import { simpleParser as parser } from 'mailparser'
// import { log } from '@stacksjs/logging'
//
// // Initialize S3
// const s3 = new AWS.S3({
//   apiVersion: '2006-03-01',
// })
//
// // Initialize SES
// const ses = new AWS.SES({
//   apiVersion: '2010-12-01',
// })
//
// // This variable will hold all the domain available in SES so we don't
// // have to query SES each time the Lambda runs, we query SES only when
// // the lambda starts from scratch to circumvent the 1 sec request limit.
// const domains: string[] = []
//
// interface Container {
//   bucket: string
//   unescaped_key: string
//   escaped_key: string
//   domains: string[]
//   folder: string
//   // wip
//   raw_email?: Buffer | Stream | string
//   to?: string
//   from?: string
//   date?: Date | string
//   subject?: string
//   message_id?: string
//   to_domain?: string
//   to_account?: string
//   from_domain?: string
//   from_account?: string
//   path?: string
// }
//
// interface S3Event {
//   Records: {
//     s3: {
//       bucket: {
//         name: string
//       }
//       object: {
//         key: string
//       }
//     }
//   }[]
// }
//
// // This Lambda will filter all the incoming emails based on their From and To field
// export function handler(event: S3Event): Promise<any> {
//   // if (!event.Records.length)
//   //   throw new Error('No records in the event')
//
//   // This JS object will contain all the data within the chain.
//   const container: Container = {
//     bucket: event.Records[0]?.s3.bucket.name || '',
//     unescaped_key: '',
//     escaped_key: event.Records[0]?.s3.object.key || '',
//     domains,
//     folder: 'Sent',
//   }
//
//   get_email_domains(container)
//     .then((container) => {
//       return unescape_key(container)
//     }).then((container) => {
//       return load_the_email(container)
//     }).then((container) => {
//       return parse_the_email(container)
//     }).then((container) => {
//       return format_time(container)
//     }).then((container) => {
//       return extract_data(container)
//     }).then((container) => {
//       return where_to_save(container)
//     }).then((container) => {
//       return create_s3_boject_key(container)
//     }).then((container) => {
//       return copy_email_to_inbox(container)
//     }).then((container) => {
//       return copy_email_to_today(container)
//     }).then((container) => {
//       return delete_the_email(container)
//     }).then(() => {
//       return true
//     }).catch((error) => {
//       console.error(error)
//
//       return false
//     })
//
//   return Promise.resolve()
// }
//
// // List all the emails added to SES, so we can use them to decided where to
// // store the emails. If in the Inbox, or sent. This is important when you
// // upload emails by hand to back them up.
// //
// // Without doing this everything goes to the Inbox folder.
// function get_email_domains(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     // If we have already the domains we don't query SES anymore since you
//     // can only query SES once a second. To solve this limitation
//     // we grab the data once, and save it in to memory.
//     if (container.domains.length)
//       return resolve(container)
//
//     log.info('get_email_domains')
//
//     const params = {
//       IdentityType: 'Domain',
//       MaxItems: 100,
//     }
//
//     ses.listIdentities(params, (error, data) => {
//       if (error) {
//         console.error(params)
//         return reject(error)
//       }
//
//       container.domains = data.Identities
//
//       return resolve(container)
//     })
//   })
// }
//
// // We need to process the path received by S3 since AWS dose escape the
// // string in a special way. They escape the string in a HTML style
// // but for whatever reason they convert spaces in to +ses.
// function unescape_key(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('unescape_key')
//
//     // First we convert the + in to spaces
//     const plus_to_space = container.escaped_key.replace(/\+/g, ' ')
//
//     // And then we unescape the string, other wise we lose real + characters
//     const unescaped_key = decodeURIComponent(plus_to_space)
//
//     container.unescaped_key = unescaped_key
//
//     return resolve(container)
//   })
// }
//
// // Load the email that we received from SES.
// function load_the_email(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('load_the_email')
//
//     const params = {
//       Bucket: container.bucket,
//       Key: container.unescaped_key,
//     }
//
//     s3.getObject(params, (error, data) => {
//       if (error) {
//         console.error(params)
//         return reject(error)
//       }
//
//       // Save the email for the next promise
//       // @ts-expect-error - refactor later
//       container.raw_email = data.Body
//
//       return resolve(container)
//     })
//   })
// }
//
// // Once the raw email is loaded we parse it with one goal in mind, get
// // the date the of the email. This way we don't rely on the SES date, but
// // on the real date the email was created.
// //
// // This way we can even load in to the system old emails as long as they
// // are in the standard raw email format, and not some proprietary solution.
// //
// // That why will be organized with the time the emails were created, and not
// // received in to the system.
// function parse_the_email(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('parse_the_email')
//
//     if (!container.raw_email)
//       return reject(Error('No raw email to parse'))
//
//     // Parse the email and extract all that is necessary
//     parser(container.raw_email, (error, data) => {
//       // Check for internal errors
//       if (error) {
//         console.error(data)
//         return reject(error)
//       }
//
//       // Save the parsed email for the next promise.
//       container.date = data.date
//       container.from = data.from?.value[0]?.address
//       // container.to = data.to?.value[0]?.address
//       container.to = data.from?.value[0]?.address
//       container.subject = data.subject || 'No Subject'
//       container.message_id = data.messageId
//
//       return resolve(container)
//     })
//   })
// }
//
// // We format the date and time to make sure that when the folder is saved
// // in S3, the object will sort one after the other which makes it much
// // easier to see the latest emails.
// function format_time(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('format_time')
//
//     // Format the date found in the email message itself
//     container.date = moment(container.date).format('YYYY-MM-DD HH:mm:ss Z')
//
//     return resolve(container)
//   })
// }
//
// // Extract all the data necessary to organize the incoming emails.
// function extract_data(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('extract_data')
//
//     if (!container.to)
//       return reject(Error('No To field in the email'))
//
//     // Since the email string can come in a form of:
//     //  Name Last <name@example.com>
//     // We have to extract just the email address, and discard the rest
//     let tmp_to
//     if (container?.to) {
//       const matchResult = container.to.match(/(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21\x23-\x5B\x5D-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21-\x5A\x53-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])+)\])/gm);
//       if (matchResult) {
//         tmp_to = matchResult[0].split('@');
//         // Continue with your logic using tmp_to
//       }
//     }
//
//     let tmp_from
//     if (container?.from) {
//       const matchResult = container.from.match(/(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21\x23-\x5B\x5D-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21-\x5A\x53-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])+)\])/gm)
//       if (matchResult) {
//         tmp_from = matchResult[0].split('@');
//         // Continue with your logic using tmp_to
//       }
//     }
//
//     if (!tmp_to || !tmp_from)
//       return reject(Error('No To or From field in the email'))
//
//     // Get the domain name of the receiving end, so we can group
//     // emails by all the domain that were added to SES.
//     container.to_domain = tmp_to[1]
//
//     // Based on the email name, we replace all the + characters, that
//     // can be used to organize ones on-line accounts in to /, this way
//     // we can build a S3 patch which will automatically organize
//     // all the email in structured folder.
//     container.to_account = tmp_to[0]?.replace(/\+/g, '/')
//
//     // Get the domain name of the email which in our case will become the company name
//     container.from_domain = tmp_from[1]
//
//     // Get the name of who sent us the email
//     container.from_account = tmp_from[0]
//
//     // Set all the strings to lower case, because some times different
//     // on-line services will have your email in all caps. For example
//     // Priceline will do this.
//     //
//     // Since in the next step we compare the domain that is in SES
//     // with the data from the email, wee need to have it all in the
//     // same format for the if() statement to work correctly and
//     // generate the right path where to save the email.
//     container.to_domain = container.to_domain?.toLowerCase()
//     container.to_account = container.to_account?.toLowerCase()
//     container.from_domain = container.from_domain?.toLowerCase()
//     container.from_account = container.from_account?.toLowerCase()
//
//     // S3 objects have a limit of how they they can be named
//     // so we remove everything but...
//     container.subject = container.subject?.replace(/[^a-zA-Z0-9 &@:,$=+?;]/g, '_')
//
//     return resolve(container)
//   })
// }
//
// // Once we have the domains from SES, and we know the value of the To
// // field, we can decide where the emails should be saved.
// function where_to_save(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('where_to_save')
//
//     // Since by default we assume that the email should be saved
//     // in the Sent folder, we need to loop over the SES domains
//     // and check if there is a match with the To: domain found in
//     // the email.
//     container.domains.forEach((domain) => {
//       if (domain === container.to_domain)
//         container.folder = 'Inbox'
//     })
//
//     return resolve(container)
//   })
// }
//
// // Create Key path for the S3 object to be saved to.
// function create_s3_boject_key(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('create_s3_boject_key')
//
//     // create the path where the email needs to be moved for house keeping
//     container.path = `${container.to_domain}/${container.to_account}/${container.from_domain}/${container.from_account}/${container.date} - ${container.subject}/` + 'email.eml'
//
//     return resolve(container)
//   })
// }
//
// // Copy the email to a new location - we don't put the email that we
// // already have in memory since the system requires a COPY action and not
// // a PUT action.
// // TODO: refactor below
// // WARNING: We are using the escaped_key value, because there is a
// // known bug in the AWS JS SDK which won't unescape the
// // string, so you have to do it - AWS is aware of this issue.
// function copy_email_to_inbox(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('copy_email_to_inbox')
//
//     const params = {
//       Bucket: container.bucket,
//       CopySource: `${container.bucket}/${container.escaped_key}`,
//       Key: `${container.folder}/${container.path}`,
//     }
//
//     s3.copyObject(params, (error, data) => {
//       if (error) {
//         console.error(params)
//         return reject(error)
//       }
//
//       return resolve(container)
//     })
//   })
// }
//
// // Similarly to the previous promise, but in this case we COPY the email to
// // the Today folder to showcase all the latest emails that were received
// // within 24h.
// //
// // There is a Lifecycle rule set on the bucket to delete any object inside
// // the Today folder if it is older then 24h.
// //
// // This way it is easier to see all the latest emails.
// function copy_email_to_today(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('copy_email_to_today')
//
//     const params = {
//       Bucket: container.bucket,
//       CopySource: `${container.bucket}/${container.escaped_key}`,
//       Key: `today/${container.path}`,
//     }
//
//     s3.copyObject(params, (error, data) => {
//       if (error) {
//         console.error(params)
//         return reject(error)
//       }
//
//       return resolve(container)
//     })
//   })
// }
//
// function delete_the_email(container: Container): Promise<Container> {
//   return new Promise((resolve, reject) => {
//     log.info('delete_the_email')
//
//     const params = {
//       Bucket: container.bucket,
//       Key: container.unescaped_key,
//     }
//
//     s3.deleteObject(params, (error, data) => {
//       if (error) {
//         console.error(params)
//         return reject(error)
//       }
//
//       return resolve(container)
//     })
//   })
// }
