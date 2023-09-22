import { Message } from '@/types/chat';
import { OpenAIModel } from '@/types/openai';

import {
  AZURE_DEPLOYMENT_ID,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
  QA_CHAIN_API_HOST,
} from '../app/const';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

interface IRequest {
  messages: any[] | undefined;
  question: string;
  collection: string;
  filters: string[];
  maxdocs: number;
  model: string | undefined;
}

interface IVectorresponse {
  request?: IRequest;
  response?: any;
  vector?: Document[];
  report?: any;
}

export const OpenAIStreamNEW = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
  maxDocs: number,
  savedChannels: string[],
) => {
  console.log('===> OpenAIStreamNEW .......... ');
  console.log('===> Messages: ', messages);
  console.log('===> Model Max lenght: ', model.maxLength);

  console.log(messages[messages.length - 1].content);
  const question = messages[messages.length - 1].content;

  // Vector Search -----------------------------------

  const request: IRequest = {
    messages: [],
    question: question,
    collection: 'discord',
    filters: savedChannels,
    maxdocs: maxDocs,
    model: model.id,
  };

  console.log('===> Request : ', request);

  let vectorUri = `${QA_CHAIN_API_HOST}search/`;

  console.log('===> VectorApiUri : ', vectorUri);

  const vectorSearchResponse = await fetch(vectorUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...request,
    }),
  });

  if (!vectorSearchResponse.ok) {
    throw new Error(vectorSearchResponse.statusText);
  }

  const vectorData = (await vectorSearchResponse.json())
    .data as IVectorresponse;

  let context = '';

  vectorData.vector?.forEach((doc: any) => {
    context = context + doc.pageContent + '\n';
  });

  console.log('===> Vector response channels : ', vectorData.report);
  console.log('// ----------------------***------------------ //');

  let prompt = `Use the following pieces of context to answer the question at the end. 
                          If you don't know the answer, just say that you don't know, 
                                    don't try to make up an answer. \n\n
          ${context} \n\n
          Question: ${request.question} \n\  Helpful Answer
   `;

  // console.log('===> Prompt : ');
  console.log('// ----------------------***------------------ //');

  // We sending only last message ... (recducing Context Size ....)
  const messageToSend = [{ role: 'user', content: prompt }];

  // OpenAI API call -----------------------------------
  let url = `${OPENAI_API_HOST}/v1/chat/completions`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_TYPE === 'openai' && {
        Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
      }),
      ...(OPENAI_API_TYPE === 'azure' && {
        'api-key': `${key ? key : process.env.OPENAI_API_KEY}`,
      }),
      ...(OPENAI_API_TYPE === 'openai' &&
        OPENAI_ORGANIZATION && {
          'OpenAI-Organization': OPENAI_ORGANIZATION,
        }),
    },
    method: 'POST',
    body: JSON.stringify({
      ...(OPENAI_API_TYPE === 'openai' && { model: model.id }),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messageToSend,
      ],
      max_tokens: 1000,
      temperature: temperature,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;
          try {
            const json = JSON.parse(data);
            if (json.choices[0].finish_reason != null) {
              controller.close();
              return;
            }
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
) => {
  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments/${AZURE_DEPLOYMENT_ID}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_TYPE === 'openai' && {
        Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
      }),
      ...(OPENAI_API_TYPE === 'azure' && {
        'api-key': `${key ? key : process.env.OPENAI_API_KEY}`,
      }),
      ...(OPENAI_API_TYPE === 'openai' &&
        OPENAI_ORGANIZATION && {
          'OpenAI-Organization': OPENAI_ORGANIZATION,
        }),
    },
    method: 'POST',
    body: JSON.stringify({
      ...(OPENAI_API_TYPE === 'openai' && { model: model.id }),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: temperature,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;

          console.log('data: ', data);

          try {
            const json = JSON.parse(data);
            if (json.choices[0].finish_reason != null) {
              controller.close();
              return;
            }
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

// This Function si depricated , Will be deleted soon ...
// The nextblock API is here
export const LangchainAiStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string,
  messages: Message[],
) => {
  // console.log(`Request custom stream :
  //                 model:, ${model}
  //                 systemPrompt:, ${systemPrompt}
  //                 temperature :, ${temperature}
  //                 key:, ${key}
  //           `);

  let url = `${QA_CHAIN_API_HOST}`;

  console.log('==> equest url: ', url);

  let question = messages[messages.length - 1].content;

  const request: IRequest = {
    messages: messages,
    question: question,
    collection: 'discord',
    maxdocs: 450,
    filters: [],
  };

  console.log('Request: ', request);

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(request),

    // body: JSON.stringify({
    //   ...(OPENAI_API_TYPE === 'openai' && { model: model.id }),
    //   messages: [
    //     {
    //       role: 'system',
    //       content: systemPrompt,
    //     },
    //     ...messages,
    //   ],
    //   max_tokens: 80000,
    //   temperature: temperature,
    //   stream: true,
    // }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  console.log('res status : ', res.status);

  let {
    data: {
      response: { text },
    },
  } = await res.json();

  console.log('----------------------------------------***');
  console.log(text);
  console.log('----------------------------------------***');

  return text;
};
