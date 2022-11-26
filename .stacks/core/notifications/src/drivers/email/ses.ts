import { SESEmailProvider } from "@novu/ses"
import { env } from '@stacksjs/utils' 
import { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless';

const provider = new SESEmailProvider({
    region: env('SES_REGION', 'test'),
    accessKeyId: env('SES_ACCESS_KEY_ID', 'test'),
    secretAccessKey: env('SES_SECRET_ACCESS_KEY', 'test'),
    from: env('SES_FROM', 'test')
});

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }