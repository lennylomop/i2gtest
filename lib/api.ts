import OpenAI from 'openai';

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const ASSISTANT_ID = 'asst_naz6Q0xwo3heDClknvL3EvGL';

const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true // Nur für Entwicklungszwecke. In Produktion sollten Sie einen Server-Endpunkt verwenden.
});

interface GPTResponse {
  answer: string;
}

export async function fetchGPTResponse(prompt: string): Promise<GPTResponse> {
  if (!API_KEY) {
    throw new Error('OpenAI API key is not set');
  }

  try {
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(message => message.role === 'assistant');

    if (assistantMessage && assistantMessage.content[0].type === 'text') {
      return { answer: assistantMessage.content[0].text.value };
    } else {
      throw new Error('Keine gültige Antwort vom Assistenten erhalten');
    }
  } catch (error) {
    console.error('Error fetching GPT response:', error);
    throw error;
  }
}

export async function* fetchGPTResponseStream(prompt: string): AsyncGenerator<string, void, unknown> {
  if (!API_KEY) {
    throw new Error('OpenAI API key is not set');
  }

  try {
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    while (true) {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data.find(message => message.role === 'assistant');
        if (assistantMessage && assistantMessage.content[0].type === 'text') {
          yield assistantMessage.content[0].text.value;
        }
        break;
      } else if (runStatus.status === 'failed') {
        throw new Error('Assistant run failed');
      }

      // Wait for a short time before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error fetching GPT response stream:', error);

    // Fallback zur Chat Completions API mit Streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant specialized in real estate matters. Provide concise and relevant information about properties, market trends, and real estate processes.' 
        },
        { role: 'user', content: prompt }
      ],
      stream: true,
    });

    for await (const part of stream) {
      const content = part.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  }
}