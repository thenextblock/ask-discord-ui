import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import {
  LangchainAiStream,
  OpenAIError,
  OpenAIStream,
  OpenAIStreamNEW,
} from '@/utils/server';

import { ChatBody, Message } from '@/types/chat';

// @ts-expect-error
import wasm from '../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';

import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken, init } from '@dqbd/tiktoken/lite/init';

export const config = {
  runtime: 'edge',
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const {
      model,
      messages,
      key,
      prompt,
      temperature,
      maxDocs,
      savedChannels,
    } = (await req.json()) as ChatBody;

    await init((imports) => WebAssembly.instantiate(wasm, imports));

    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str,
    );

    let promptToSend = prompt;

    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    console.log('promptToSend: ', promptToSend);

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const prompt_tokens = encoding.encode(promptToSend);

    let tokenCount = prompt_tokens.length;
    let messagesToSend: Message[] = [];

    console.log('prompt_tokens count: ', tokenCount);

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length + 1000 > model.tokenLimit) {
        break;
      }
      tokenCount += tokens.length;
      messagesToSend = [message, ...messagesToSend];
    }

    encoding.free();

    // return new Response('ok');
    console.log('Max Docs before send', maxDocs);

    const stream = await OpenAIStreamNEW(
      model,
      promptToSend,
      temperatureToUse,
      key,
      messagesToSend,
      parseInt(maxDocs),
      savedChannels,
    );

    return new Response(stream);

    // const stream = await LangchainAiStream(
    //   model,
    //   promptToSend,
    //   temperatureToUse,
    //   key,
    //   messagesToSend,
    // );

    // const stream = await OpenAIStream(
    //   model,
    //   promptToSend,
    //   temperatureToUse,
    //   key,
    //   messagesToSend,
    // );
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      return new Response('Error', { status: 500, statusText: error.message });
    } else {
      return new Response('Error', { status: 500 });
    }
  }
};

export default handler;
