---
title: Limitations
description: "It's always best to know some of the known limitations to avoid surprises."
---
# Limitations

It's always best to know some of the known limitations to avoid surprises.

## Cloud

### Email Server

#### SES

New SES accounts begin in the sandbox for each AWS Region. In the sandbox, sending is limited to verified recipients and the default quota is 200 recipients per 24 hours at one recipient per second.

Request production access before sending application mail to unverified recipients. Production access and quota increases are AWS account and Region specific. Review the current [Amazon SES sending quotas](https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas.html) before deployment.

##### Enable SES Rule Sets

A Stacks deployment creates an SES receipt rule set. Amazon SES evaluates only the active rule set, so verify the deployed set is active when the account already has email-receiving infrastructure.

1. Open Amazon SES in the deployment Region.
2. Open Email receiving and select Rule sets.
3. Select the rule set created by the Stacks deployment.
4. Set it as active and send a controlled test message.

AWS documents the same operation in [SetActiveReceiptRuleSet](https://docs.aws.amazon.com/ses/latest/APIReference/API_SetActiveReceiptRuleSet.html).
