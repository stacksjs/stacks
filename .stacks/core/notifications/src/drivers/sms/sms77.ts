import { Sms77SmsProvider } from '@novu/sms77';
import { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless';
import { env } from '@stacksjs/utils' 

const provider = new Sms77SmsProvider({
    apiKey: env('SMS77_API_KEY', 'test') ,
    from: env('SMS77_FROM', 'test')
});

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options);
}

export { send as Send, send } 