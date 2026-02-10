import { NextRequest } from 'next/server';
import { askGemini } from '@/lib/ai/geminiService';
import { askChatGPT, summarizeResponses } from '@/lib/ai/openaiService';
import { config } from '@/lib/config';
import logger from '@/lib/logger';
import { cleanText } from '@/lib/utils/textCleaner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, history } = body;
    const conversationHistory: { question: string; answer: string }[] = Array.isArray(history) ? history : [];

    if (!question || typeof question !== 'string' || question.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'A question or prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info(`Streaming text-only question: ${question.substring(0, 80)}...`);

    const hasGemini = !!config.geminiApiKey;
    const hasOpenAI = !!config.openaiApiKey;

    if (!hasGemini && !hasOpenAI) {
      return new Response(JSON.stringify({ error: 'No AI API keys configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Fire both AI services in parallel — stream each result as it arrives
          const geminiPromise = hasGemini
            ? askGemini(question, question, undefined, conversationHistory)
                .then((r) => {
                  const cleaned = cleanText(r.text);
                  send('gemini', { text: cleaned, model: r.model, timestamp: r.timestamp });
                  return { ...r, text: cleaned };
                })
                .catch((e) => {
                  logger.error('Gemini stream error:', e);
                  const fallback = { text: `Gemini error: ${e.message}`, model: 'Error', timestamp: new Date() };
                  send('gemini', fallback);
                  return fallback;
                })
            : Promise.resolve(
                (() => {
                  const fallback = { text: 'Gemini not configured', model: 'Not configured', timestamp: new Date() };
                  send('gemini', fallback);
                  return fallback;
                })()
              );

          const chatgptPromise = hasOpenAI
            ? askChatGPT(question, question, undefined, conversationHistory)
                .then((r) => {
                  const cleaned = cleanText(r.text);
                  send('chatgpt', { text: cleaned, model: r.model, timestamp: r.timestamp });
                  return { ...r, text: cleaned };
                })
                .catch((e) => {
                  logger.error('ChatGPT stream error:', e);
                  const fallback = { text: `ChatGPT error: ${e.message}`, model: 'Error', timestamp: new Date() };
                  send('chatgpt', fallback);
                  return fallback;
                })
            : Promise.resolve(
                (() => {
                  const fallback = { text: 'ChatGPT not configured', model: 'Not configured', timestamp: new Date() };
                  send('chatgpt', fallback);
                  return fallback;
                })()
              );

          const [geminiResult, chatgptResult] = await Promise.all([geminiPromise, chatgptPromise]);

          // Generate summary from all available AI responses
          let summary;
          const validResponses = [
            hasGemini && geminiResult ? { name: 'Gemini', text: geminiResult.text, model: geminiResult.model } : null,
            hasOpenAI && chatgptResult ? { name: 'ChatGPT', text: chatgptResult.text, model: chatgptResult.model } : null,
          ].filter((r) => r && !r.text.includes('error:') && !r.text.includes('not configured'));

          if (validResponses.length >= 2 && hasOpenAI) {
            try {
              // Use ChatGPT and Gemini for summarization (existing function)
              summary = await summarizeResponses(
                validResponses[0]?.text || '',
                validResponses[1]?.text || ''
              );
              summary.text = cleanText(summary.text);
            } catch (e) {
              summary = { text: validResponses[0]?.text || '', model: 'Fallback (summary failed)', timestamp: new Date() };
            }
          } else if (validResponses.length > 0) {
            const best = validResponses[0];
            summary = { text: best?.text || '', model: `${best?.model} (Single source)`, timestamp: new Date() };
          } else {
            summary = { text: 'No AI responses available', model: 'Error', timestamp: new Date() };
          }

          send('summary', { text: summary.text, model: summary.model, timestamp: summary.timestamp });
          send('done', {});
          controller.close();
        } catch (error) {
          logger.error('Stream error:', error);
          send('error', { message: error instanceof Error ? error.message : 'Unknown error' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('Ask route error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
