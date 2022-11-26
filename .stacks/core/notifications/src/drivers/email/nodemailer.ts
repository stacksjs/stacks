import { NodemailerProvider } from '@novu/nodemailer';
import { env } from '@stacksjs/utils' 
import { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless';

const provider = new NodemailerProvider({
  from: env('NODEMAILER_FROM_EMAIL', 'test'),
  host: env('NODEMAILER_HOST', 'test'),
  user: env('NODEMAILER_USERNAME', 'test'),
  password: env('NODEMAILER_PASSWORD', 'test'),
  port: env('NODEMAILER_PORT', 'test'),
  secure: env('NODEMAILER_SECURE', 'test'),
});

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }