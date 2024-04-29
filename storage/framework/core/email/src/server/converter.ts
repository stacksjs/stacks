// const AWS = require('aws-sdk')
// const mime = require('mime')
// const parser = require('mailparser').simpleParser
//
// // Initialize S3.
// const s3 = new AWS.S3({
//   apiVersion: '2006-03-01',
// })
//
// // This lambda will read RAW emails and convert them in easy to read formats
// // like: HTML and text
// exports.handler = (event: any) => {
//   // 1. We need to process the path received by S3 since AWS dose escape the
//   // string in a special way. They escape the string in a HTML style
//   // but for whatever reason they convert spaces in to +ses.
//   const s3_key = event.Records[0].s3.object.key
//
//   // 2. So first we convert the + in to spaces
//   const plus_to_space = s3_key.replace(/\+/g, ' ')
//
//   // 3. And then we unescape the string, other wise we lose real + characters
//   const unescaped_key = decodeURIComponent(plus_to_space)
//
//   // 4. This JS object will contain all the data within the chain
//   const container = {
//     bucket: event.Records[0].s3.bucket.name,
//     key: unescaped_key,
//     parsed: {
//       html: '',
//       text: '',
//       attachments: [],
//     },
//   }
//
//   // -> Start the chain.
//   load_the_email(container)
//     .then((container) => {
//       return remove_extension(container)
//     }).then((container) => {
//       return parse_the_email(container)
//     }).then((container) => {
//       return save_text(container)
//     }).then((container) => {
//       return save_html(container)
//     }).then((container) => {
//       return save_attachments(container)
//     }).then((container) => {
//       return true
//     }).catch((error) => {
//       console.error(error)
//
//       return false
//     })
// }
//
// // Load the email that triggered the function from S3
// function load_the_email(container: any) {
//   return new Promise((resolve, reject) => {
//     console.info('load_the_email')
//
//     // 1. Set the query.
//     const params = {
//       Bucket: container.bucket,
//       Key: container.key,
//     }
//
//     // -> Execute the query
//     s3.getObject(params, (error: any, data: any) => {
//       // 1. Check for internal errors
//       if (error)
//         return reject(error)
//
//       // 2. Save the email for the next promise
//       container.raw_email = data.Body
//
//       // -> Move to the next chain.
//       return resolve(container)
//     })
//   })
// }
//
// // Since the raw email is saved with an extension we need to remove it
// // before we can save other converted versions.
// function remove_extension(container: any) {
//   return new Promise((resolve, reject) => {
//     console.info('remove_extension')
//
//     // 1. Split the string.
//     const tmp = container.key.split('.')
//
//     // 2. Remove the last element from the array which is `eml`.
//     tmp.pop()
//
//     // 2. Join the array back to how it was, minus the extension.
//     // We need to do this, since we don't know how many dots
//     // were in the email title for example.
//     container.key = tmp.join('.')
//
//     // -> Move to the next chain.
//     return resolve(container)
//   })
// }
//
// // Convert the raw email in to HTML and Text, and extract also the attachments
// function parse_the_email(container: any) {
//   return new Promise((resolve, reject) => {
//     // 1. Parse the email and extract all the necessary
//     parser(container.raw_email, (error: any, parsed: any) => {
//       // 1. Check for internal errors
//       if (error)
//         return reject(error)
//
//       // 2. Save the parsed email for the next promise.
//       container.parsed.html = parsed.html
//       container.parsed.text = parsed.text
//       container.parsed.attachments = parsed.attachments
//
//       // -> Move to the next chain.
//       return resolve(container)
//     })
//   })
// }
//
// // After the conversion we save the Text version to S3.
// function save_text(container: any) {
//   return new Promise((resolve, reject) => {
//     console.info('save_text')
//
//     // 1. Set the query
//     const params = {
//       Bucket: container.bucket,
//       Key: `${container.key}.txt`,
//       Body: container.parsed.text,
//     }
//
//     // -> Execute the query.
//     s3.putObject(params, (error: any, data: any) => {
//       // 1. Check for internal errors.
//       if (error)
//         return reject(error)
//
//       // -> Move to the next chain.
//       return resolve(container)
//     })
//   })
// }
//
// // Then if we have a HTML version we try to save that.
// function save_html(container: any) {
//   return new Promise((resolve, reject) => {
//     // <>> When the body of an email have only one version, meaning it
//     // does have only the pure text version and no HTML.
//     // Nodemailer won't generate the HTML for you, it just grabs
//     // what is in the Email body.
//     // So, this value will be false, when there is no HTML content in
//     // the email, and thus we skip this step.
//     if (!container.parsed.html) {
//       console.info('save_html - skipped')
//
//       // -> Move to the next chain.
//       return resolve(container)
//     }
//
//     console.info('save_html')
//
//     // 1. Set the query.
//     const params = {
//       Bucket: container.bucket,
//       Key: `${container.key}.html`,
//       Body: container.parsed.html,
//     }
//
//     // -> Execute the query.
//     s3.putObject(params, (error: any, data: any) => {
//       // 1. Check for internal errors.
//       if (error)
//         return reject(error)
//
//       // -> Move to the next chain.
//       return resolve(container)
//     })
//   })
// }
//
// // Last thing to do is to save the attachments if there are any. If the
// // array is empty the loop will skip itself.
// function save_attachments(container: any) {
//   return new Promise((resolve, reject) => {
//     console.info('save_attachments')
//
//     // Start the loop which save all the attachments.
//     loop(1, (error: any) => {
//       // <<> Check if there was an error.
//       if (error) {
//         // -> Stop everything and surface the error.
//         return reject(container)
//       }
//
//       // -> Move to the next chain.
//       return resolve(container)
//     })
//
//     // This loop will upload all the individual attachments found in a email
//     function loop(count: any, callback: any) {
//       // 1. Pop the last element in the array if any.
//       const file = container.parsed.attachments.pop()
//
//       // 2. If there is nothing left then we stop the loop.
//       if (!file)
//         return callback()
//
//       // 3. Get the file name which also contain the file extension.
//       let file_name = file.filename
//
//       // 4. An email attachment is not required to have a name, this
//       // mean we need to check if we have a file name and, if not
//       // we create a general name, so all attachments can be saved
//       // and accounted for.
//       if (!file_name) {
//         // 1. Set the generic name with the count name so we give
//         // unique names to each attachment.
//         file_name = `Mail Attachment ${count}`
//
//         // 2. We only count the times we had to set a generic name.
//         count++
//       }
//
//       // 5. Split the string to and get the last element of the array
//       // which should be the file extension.
//       const extension = file_name.split('.').pop()
//
//       // 6. Then we check if the last element is an extension.
//       const is_extension = mime.getType(extension)
//
//       // 7. If it isn't, we get one from the content-type header.
//       if (!is_extension) {
//         // 1. Make sure we have a content type, since I'm sure
//         // some emails won't have it if they were malformed.
//         if (file.contentType) {
//           // 1. Try to find out the file extension from the
//           // content-type found in the email message.
//           let file_type = mime.getExtension(file.contentType)
//
//           // 2. If the extension was not found, then we set a
//           // default one which will let the user know
//           // that we don't know the type of the file, while
//           // also setting the type to txt (for convenience)
//           // so it can be open by any editor and inspected.
//           if (!file_type)
//             file_type = 'unknown_extension.txt'
//
//           // 3. Attach the extension to the file.
//           file_name += `.${file_type}`
//         }
//       }
//
//       // 8. Then save the buffer of the attachment.
//       const file_body = file.content
//
//       // 9. Split the S3 Key (path) so we can remove the last element. Since
//       // we don't want the object name, we care only about the path.
//       const tmp = container.key.split('/')
//
//       // 10. Now remove the last element from the array which is the
//       // file name that contains the raw email, which we don't want.
//       tmp.pop()
//
//       // 11. After all this, we recombine the array in to a single
//       // string which becomes again the S3 Key minus the file name.
//       const path = tmp.join('/')
//
//       // 12. This variable is used if there are two files of the same name.
//       let cid = ''
//
//       // 13. If the CID is set then it means that two files have the same names
//       if (file.cid) {
//         // 1. Add the CID in front of the name of the file so they won't be overwritten
//         cid = `${file.cid} - `
//       }
//
//       // 14. Create the full key path with the object at the end.
//       const key =  `${path}/attachments/${cid}${file_name}`
//
//       // 15. Set the query.
//       const params = {
//         Bucket: container.bucket,
//         Key: key,
//         Body: file_body,
//       }
//
//       // -> Execute the query.
//       s3.putObject(params, (error: any, data: any) => {
//         // 1. Check for internal errors.
//         if (error)
//           return callback(error)
//
//         // -> Move to the next chain.
//         return loop(count, callback)
//       })
//     }
//   })
// }
