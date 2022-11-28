import { DiscordProvider } from '@novu/discord';
import { IChatOptions, ISendMessageSuccessResponse } from '@novu/stateless';

const provider = new DiscordProvider({});

async function send(options: IChatOptions): Promise<ISendMessageSuccessResponse> {
    return await provider.sendMessage(options)
}

export { send as Send, send }