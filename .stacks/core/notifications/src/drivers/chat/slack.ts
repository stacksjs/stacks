import { SlackProvider } from '@novu/slack';
import { IChatOptions, ISendMessageSuccessResponse } from '@novu/stateless';
import { env } from '@stacksjs/utils' 

const provider = new SlackProvider({
  applicationId: env('SLACK_APPLICATION_ID', 'test'),
  clientID: env('SLACK_CLIENT_ID', 'test'), 
  secretKey: env('SLACK_SECRET_KEY', 'test')
});

async function send(options: IChatOptions): Promise<ISendMessageSuccessResponse> {
    return await provider.sendMessage(options)
}

export { send as Send, send }