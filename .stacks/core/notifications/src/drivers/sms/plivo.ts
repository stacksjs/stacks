import { PlivoSmsProvider } from '@novu/plivo';
import { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless';
import { env } from '@stacksjs/utils' 

const provider = new PlivoSmsProvider({
  accountSid: env('PLIVO_ACCOUNT_ID', 'test'),
  authToken: env('PLIVO_AUTH_TOKEN', 'test'),
  from: env('PLIVO_FROM_NUMBER', 'test'),
});

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options);
}

export { send as Send, send } 