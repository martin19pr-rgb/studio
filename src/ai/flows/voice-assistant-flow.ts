
'use server';
/**
 * @fileOverview A conversational AI voice assistant flow for emergency guidance.
 *
 * - voiceAssistant - A function that handles general emergency conversation with contextual intelligence.
 * - VoiceAssistantInput - The input type for the voiceAssistant function.
 * - VoiceAssistantOutput - The return type for the voiceAssistant function (text + audio).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import wav from 'wav';

const VoiceAssistantInputSchema = z.object({
  transcript: z.string().describe("The user's voice query or statement."),
  userName: z.string().optional().describe("The citizen's name for personalized response."),
  location: z.string().optional().describe("The user's current location or landmark."),
  medicalNotes: z.string().optional().describe("Relevant medical info like blood type or allergies."),
});
export type VoiceAssistantInput = z.infer<typeof VoiceAssistantInputSchema>;

const VoiceAssistantOutputSchema = z.object({
  text: z.string().describe("The assistant's text response."),
  audioDataUri: z.string().describe('The generated response as a WAV audio data URI.'),
});
export type VoiceAssistantOutput = z.infer<typeof VoiceAssistantOutputSchema>;

const assistantPrompt = ai.definePrompt({
  name: 'voiceAssistantPrompt',
  input: { schema: VoiceAssistantInputSchema },
  output: { schema: z.string().describe('A concise, helpful, and reassuring response.') },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }, // Allow emergency help
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    ],
  },
  prompt: `You are the Provincial Emergency AI Command Assistant. Your tone is calm, authoritative, and extremely supportive.
You are the "brain" of a safety network connecting citizens of Limpopo to emergency responders.

Context:
- Citizen Name: {{{userName}}}
- Current Location: {{{location}}}
- Medical Status: {{{medicalNotes}}}

User Query: {{{transcript}}}

Rules:
1. Address the user by name if available (e.g., "Understood, Lebogang...").
2. Be extremely concise (max 2 sentences).
3. Provide actionable safety advice or confirm that the system is monitoring their situation.
4. If they sound in distress or report a crime, remind them you are ready to dispatch police or an ambulance immediately.
5. If the user is in a delicate or life-threatening situation, use a whisper-like calm tone in your text instructions.
6. Do not use complex jargon. Focus on immediate safety.`,
});

const voiceAssistantFlow = ai.defineFlow(
  {
    name: 'voiceAssistantFlow',
    inputSchema: VoiceAssistantInputSchema,
    outputSchema: VoiceAssistantOutputSchema,
  },
  async (input) => {
    const { output: textResponse } = await assistantPrompt(input);

    if (!textResponse) {
      throw new Error('Failed to generate assistant response.');
    }

    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' },
          },
        },
      },
      prompt: textResponse,
    });

    if (!media || !media.url) {
      throw new Error('No audio media returned.');
    }

    const audioBase64 = media.url.substring(media.url.indexOf(',') + 1);
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const wavBase64 = await toWav(audioBuffer);

    return {
      text: textResponse,
      audioDataUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);

export async function voiceAssistant(input: VoiceAssistantInput): Promise<VoiceAssistantOutput> {
  return voiceAssistantFlow(input);
}

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}
