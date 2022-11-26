import { env } from '@stacksjs/utils' 
import { SendgridEmailProvider } from '@novu/sendgrid';
import { IEmailOptions } from '@novu/stateless';

const provider = new SendgridEmailProvider({
  apiKey: env('SENDGRID_API_KEY', 'test')
});

const send = async (options: IEmailOptions) => {
  await provider.sendMessage(options)
}

export { send as Send, send }