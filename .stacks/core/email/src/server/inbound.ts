const AWS = require('aws-sdk')
const moment = require('moment')
const parser = require('mailparser').simpleParser

//
//	Initialize S3.
//
const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
})

//
//	Initialize SES.
//
const ses = new AWS.SES({
  apiVersion: '2010-12-01',
})

//
//	This variable will hold all the domain available in SES so we don't
//	have to query SES each time the Lambda runs, we query SES only when
//	the lambda starts from scratch to circumvent the 1 sec request limit.
//
const domains = []

//
//	This Lambda will filter all the incoming emails based on their From and To
//	field.
//
exports.handler = (event) => {
  //
  //	1.	This JS object will contain all the data within the chain.
  //
  const container = {
    bucket: event.Records[0].s3.bucket.name,
    unescaped_key: '',
    escaped_key: event.Records[0].s3.object.key,
    domains,
    folder: 'Sent',
  }

  //
  //	->	Start the chain.
  //
  get_email_domains(container)
    .then((container) => {
      return unescape_key(container)
    }).then((container) => {
      return load_the_email(container)
    }).then((container) => {
      return parse_the_email(container)
    }).then((container) => {
      return format_time(container)
    }).then((container) => {
      return extract_data(container)
    }).then((container) => {
      return where_to_save(container)
    }).then((container) => {
      return create_s3_boject_key(container)
    }).then((container) => {
      return copy_email_to_inbox(container)
    }).then((container) => {
      return copy_email_to_today(container)
    }).then((container) => {
      return delete_the_email(container)
    }).then((container) => {
      return true
    }).catch((error) => {
      console.error(error)

      return false
    })
}

//	 _____    _____     ____    __  __   _____    _____   ______    _____
//	|  __ \  |  __ \   / __ \  |  \/  | |_   _|  / ____| |  ____|  / ____|
//	| |__) | | |__) | | |  | | | \  / |   | |   | (___   | |__    | (___
//	|  ___/  |  _  /  | |  | | | |\/| |   | |    \___ \  |  __|    \___ \
//	| |      | | \ \  | |__| | | |  | |  _| |_   ____) | | |____   ____) |
//	|_|      |_|  \_\  \____/  |_|  |_| |_____| |_____/  |______| |_____/
//

//
//	List all the emails added to SES, so we can use them to decided where to
//	store the emails. If in the Inbox, or sent. This is important when you
//	upload emails by hand to back them up.
//
//	Without doing this everything goes to the Inbox folder.
//
function get_email_domains(container) {
  return new Promise((resolve, reject) => {
    //
    //	1.	If we have already the domains we don't query SES anymore
    //		since you can only query SES once a second. To solve this
    //		limitation we grab the data once, and save it in to memory.
    //
    if (container.domains.length) {
      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    }

    console.info('get_email_domains')

    //
    //	2.	Create the query.
    //
    const params = {
      IdentityType: 'Domain',
      MaxItems: 100,
    }

    //
    //	->	Execute the query.
    //
    ses.listIdentities(params, (error, data) => {
      //
      //	1.	Check for internal errors.
      //
      if (error) {
        console.error(params)
        return reject(error)
      }

      container.domains = data.Identities

      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    })
  })
}

//
//	We need to process the path received by S3 since AWS dose escape
//	the string in a special way. They escape the string in a HTML style
//	but for whatever reason they convert spaces in to +ses.
//
function unescape_key(container) {
  return new Promise((resolve, reject) => {
    console.info('unescape_key')

    //
    //	1.	First we convert the + in to spaces.
    //
    const plus_to_space = container.escaped_key.replace(/\+/g, ' ')

    //
    //	2.	And then we unescape the string, other wise we lose
    //		real + characters.
    //
    const unescaped_key = decodeURIComponent(plus_to_space)

    //
    //	3.	Save the result for the next promise.
    //
    container.unescaped_key = unescaped_key

    //
    //	->	Move to the next chain.
    //
    return resolve(container)
  })
}

//
//	Load the email that we received from SES.
//
function load_the_email(container) {
  return new Promise((resolve, reject) => {
    console.info('load_the_email')

    //
    //	1.	Set the query.
    //
    const params = {
      Bucket: container.bucket,
      Key: container.unescaped_key,
    }

    //
    //	->	Execute the query.
    //
    s3.getObject(params, (error, data) => {
      //
      //	1.	Check for internal errors.
      //
      if (error) {
        console.error(params)
        return reject(error)
      }

      //
      //	2.	Save the email for the next promise
      //
      container.raw_email = data.Body

      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    })
  })
}

//
//	Once the raw email is loaded we parse it with one goal in mind, get
//	the date the of the email. This way we don't rely on the SES date, but
//	on the real date the email was created.
//
//	This way we can even load in to the system old emails as long as they
//	are in the standard raw email format, and not some proprietary solution.
//
//	That why will be organized with the time the emails were created, and not
//	received in to the system.
//
function parse_the_email(container) {
  return new Promise((resolve, reject) => {
    console.info('parse_the_email')

    //
    //	1.	Parse the email and extract all the it necessary.
    //
    parser(container.raw_email, (error, data) => {
      //
      //	1.	Check for internal errors.
      //
      if (error) {
        console.error(data)
        return reject(error)
      }

      //
      //	2.	Save the parsed email for the next promise.
      //
      container.date			= data.date
      container.from 			= data.from.value[0].address,
      container.to 			= data.to.value[0].address,
      container.subject		= data.subject || 'No Subject',
      container.message_id	= data.messageId

      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    })
  })
}

//
//	We format the date and time to make sure that when the folder is saved
//	in S3, the object will sort one after the other which makes it much
//	easier to see the latest emails.
//
function format_time(container) {
  return new Promise((resolve, reject) => {
    console.info('format_time')

    //
    //	1.	Format the date found in the email message itself.
    //
    container.date = moment(container.date).format('YYYY-MM-DD HH:mm:ss Z')

    //
    //	->	Move to the next chain.
    //
    return resolve(container)
  })
}

//
//	Extract all the data necessary to organize the incoming emails.
//
function extract_data(container) {
  return new Promise((resolve, reject) => {
    console.info('extract_data')

    //
    //	1.	Since the email string can come in a form of:
    //
    //			Name Last <name@example.com>
    //
    //		We have to extract just the email address, and discard
    //		the rest.
    //
    const tmp_to = 	container
      .to
      .match(/(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21\x23-\x5B\x5D-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21-\x5A\x53-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])+)\])/gm)[0]
      .split('@')

    const tmp_from = 	container
      .from
      .match(/(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21\x23-\x5B\x5D-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21-\x5A\x53-\x7F]|\\[\x01-\x09\x0B\x0C\x0E-\x7F])+)\])/gm)[0]
      .split('@')

    //
    //	2.	Get the domain name of the receiving end, so we can group
    //		emails by all the domain that were added to SES.
    //
    container.to_domain = tmp_to[1]

    //
    //	3.	Based on the email name, we replace all the + characters, that
    //		can be used to organize ones on-line accounts in to /, this way
    //		we can build a S3 patch which will automatically organize
    //		all the email in structured folder.
    //
    container.to_account = tmp_to[0].replace(/\+/g, '/')

    //
    //	4.	Get the domain name of the email which in our case will
    //		become the company name.
    //
    container.from_domain = tmp_from[1]

    //
    //	5.	Get the name of who sent us the email.
    //
    container.from_account = tmp_from[0]

    //
    //	6.	Set all the strings to lower case, because some times different
    //		on-line services will have your email in all caps. For example
    //		Priceline will do this.
    //
    //		Since in the next step we compare the domain that is in SES
    //		with the data from the email, wee need to have it all in the
    //		same format for the if() statement to work correctly and
    //		generate the right path where to save the email.
    //
    container.to_domain = container.to_domain.toLowerCase()
    container.to_account = container.to_account.toLowerCase()
    container.from_domain = container.from_domain.toLowerCase()
    container.from_account = container.from_account.toLowerCase()

    //
    //	7.	S3 objects have a limit of how they they can be named
    //		so we remove everything but...
    //
    container.subject = container.subject.replace(/[^a-zA-Z0-9 &@:,$=+?;]/g, '_')

    //
    //	->	Move to the next chain.
    //
    return resolve(container)
  })
}

//
//	Once we have the domains from SES, and we know the value of the To
//	field, we can decide where the emails should be saved.
//
function where_to_save(container) {
  return new Promise((resolve, reject) => {
    console.info('where_to_save')

    //
    //	1.	Since by default we assume that the email should be saved
    //		in the Sent folder, we need to loop over the SES domains
    //		and check if there is a match with the To: domain found in
    //		the email.
    //
    container.domains.forEach((domain) => {
      if (domain == container.to_domain)
        container.folder = 'Inbox'
    })

    //
    //	->	Move to the next chain.
    //
    return resolve(container)
  })
}

//
//	Create Key path for the S3 object to be saved to.
//
function create_s3_boject_key(container) {
  return new Promise((resolve, reject) => {
    console.info('create_s3_boject_key')

    //
    //	1.	Create the path where the email needs to be moved
    //		so it is properly organized.
    //
    container.path = `${container.to_domain
					    }/${
					    container.to_account
					    }/${
					    container.from_domain
					    }/${
					    container.from_account
					    }/${
					    container.date
					    } - ${
					    container.subject
					    }/`
					   + 'email.eml'

    //
    //	->	Move to the next chain.
    //
    return resolve(container)
  })
}

//
//	Copy the email to a new location - we don't put the email that we
//	already have in memory since the system requires a COPY action and not
//	a PUT action.
//
//		WARNING: 	We are using the escaped_key value, because there is a
//					know bug in the AWS JS SDK which won't unescape the
//					string, so you have to do it - AWS is aware of this issue.
//
function copy_email_to_inbox(container) {
  return new Promise((resolve, reject) => {
    console.info('copy_email_to_inbox')

    //
    //	1.	Set the query.
    //
    const params = {
      Bucket: container.bucket,
      CopySource: `${container.bucket}/${container.escaped_key}`,
      Key: `${container.folder}/${container.path}`,
    }

    //
    //	->	Execute the query.
    //
    s3.copyObject(params, (error, data) => {
      //
      //	1.	Check for internal errors.
      //
      if (error) {
        console.error(params)
        return reject(error)
      }

      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    })
  })
}

//
//	Similarly to the previous promise, but in this case we COPY the email to
//	the Today folder to showcase all the latest emails that were received
//	within 24h.
//
//	There is a Lifecycle rule set on the bucket to delete any object inside
//	the Today folder if it is older then 24h.
//
//	This way it is easier to see all the latest emails.
//
function copy_email_to_today(container) {
  return new Promise((resolve, reject) => {
    console.info('copy_email_to_today')

    //
    //	1.	Set the query.
    //
    const params = {
      Bucket: container.bucket,
      CopySource: `${container.bucket}/${container.escaped_key}`,
      Key: `Today/${container.path}`,
    }

    //
    //	->	Execute the query.
    //
    s3.copyObject(params, (error, data) => {
      //
      //	1.	Check for internal errors.
      //
      if (error) {
        console.error(params)
        return reject(error)
      }

      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    })
  })
}

//
//	Delete the original message.
//
function delete_the_email(container) {
  return new Promise((resolve, reject) => {
    console.info('delete_the_email')

    //
    //	1.	Set the query.
    //
    const params = {
      Bucket: container.bucket,
      Key: container.unescaped_key,
    }

    //
    //	->	Execute the query.
    //
    s3.deleteObject(params, (error, data) => {
      //
      //	1.	Check for internal errors.
      //
      if (error) {
        console.error(params)
        return reject(error)
      }

      //
      //	->	Move to the next chain.
      //
      return resolve(container)
    })
  })
}
