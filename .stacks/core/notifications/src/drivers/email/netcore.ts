import { NetCoreProvider } from '@novu/netcore';
import { env } from '@stacksjs/utils' 
import { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless';

const provider = new NetCoreProvider(env('NETCORE_API_KEY', 'test'));

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }