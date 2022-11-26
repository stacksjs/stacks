import { TelnyxSmsProvider } from '@novu/telnyx';
import { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless';
import { env } from '@stacksjs/utils' 

const provider = new TelnyxSmsProvider({
  apiKey: env('TELNYX_API_KEY', 'test'),
  messageProfileId:  env('TELNYX_MESSAGE_PROFILE_ID', 'test'),
  from: env('TELNYX_FROM', 'test'),
});

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options);
}

export { send as Send, send } 