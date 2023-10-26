# Limitations

It's always best to know some of the known limitations to avoid surprises.

## Cloud

### Email Server

#### SES

There are two major limitations with SES:

For security reasons, AWS defaults to 200 emails sent per 24 hour period at a rate of 1 email/second. If you need to send more than that, you'll need to request a limit increase.

By default, you can't send emails to unverified addresses. If you'd like to be able to send (as opposed to just receiving), you'll need to reach out to AWS to remove this limitation from your account.

Follow this link to get it done:

wip

##### Enable SES Rule Sets

A Stacks deployment creates a SES rule set. This rule set should be enabled by default on fresh AWS accounts, but on accounts where you may already have some existing rules, this won't work. This behavior is a known bug by AWS in CloudFormation. Taking the following steps will enable the rule:

1. Go to the SES Dashboard
2. Click Rule Sets on the left side menu
3. Check `` on the Inactive Rule Sets tab
4. Hit Set as Active Rule Set to activate the rule
