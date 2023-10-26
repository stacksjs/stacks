# How to create your own mailbox/es?

Creating a full-fledged email server complicated. A significant overhead due to the need for server installation and configuration. Stacks deploys a streamlined solution leveraging AWS SES for email handling and S3 for data storage. AWS Lambda ties these components together, providing a simple, serverless email server solution.

- Unmanaged email server
- Unlimited email addresses/mailboxes
- Easily organize messages
- No server installation or configuration
- No server maintenance

## Endless email addresses

Once you add and confirm your domain with SES, you can put any string you want in front of the `@`, as long as it conforms to the email address standard. This means that you'll have endless email addresses at your disposal, and you'll be able to organize your life in a way never possible before. For example, you can give each service you sign up for its own special email:

- <facebook@example.com>
- <instagram@example.com>
- <linkedin@example.com>
- etc.

### Organizing with a +

With that said, you can organize your emails with the `+` character in this way:

- <accounts+social+facebook@example.com>
- <accounts+social+instagram@example.com>
- <accounts+social+linkedin@example.com>
- <accounts+travel+car+hertz@example.com>
- <accounts+travel+air+jetblue@example.com>
- <accounts+money+paypal@example.com>
- etc.

When dealing with clients we came up with this folder structure:

- <clients+company_name+aws+account_name@example.com>
- <clients+company_name+stripe@example.com>
- <clients+company_name+sentry@example.com>
- <clients+company_name+heroku@example.com>
- etc.

For all sorts of alerts we like to group them like this

- <alarms+company_name+aws+account_name+alarm_type@example.com>
- <alarms+company_name+sentry+alarm_type@example.com>
- etc.

This groups all emails in the corresponding folder by replacing the `+` with a `/` character which creates a folder structure in S3. The possibilities are endless.

### Thank You

Thank you <https://github.com/0x4447/0x4447_product_s3_email> for much of the inspiration!
