'use server';

/**
 * @fileOverview An AI agent that suggests ephemeral settings (expiration time or burn-on-read) for a given message.
 *
 * - suggestEphemeralSettings - A function that suggests ephemeral settings.
 * - SuggestEphemeralSettingsInput - The input type for the suggestEphemeralSettings function.
 * - SuggestEphemeralSettingsOutput - The return type for the suggestEphemeralSettings function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestEphemeralSettingsInputSchema = z.object({
  message: z.string().describe('The message to analyze.'),
});
export type SuggestEphemeralSettingsInput = z.infer<typeof SuggestEphemeralSettingsInputSchema>;

const SuggestEphemeralSettingsOutputSchema = z.object({
  expirationTimeSuggestion: z
    .enum(['1 minute', '1 hour', '1 day', 'never'])
    .describe('The suggested expiration time for the message.'),
  burnOnReadSuggestion: z.boolean().describe('Whether burn-on-read is suggested.'),
  reasoning: z
    .string()
    .describe('The reasoning behind the expiration time and burn-on-read suggestions.'),
});
export type SuggestEphemeralSettingsOutput = z.infer<typeof SuggestEphemeralSettingsOutputSchema>;

export async function suggestEphemeralSettings(
  input: SuggestEphemeralSettingsInput
): Promise<SuggestEphemeralSettingsOutput> {
  return suggestEphemeralSettingsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestEphemeralSettingsPrompt',
  input: {schema: SuggestEphemeralSettingsInputSchema},
  output: {schema: SuggestEphemeralSettingsOutputSchema},
  prompt: `You are an AI assistant that analyzes messages and suggests appropriate ephemeral settings for them to enhance privacy.

  Analyze the following message and suggest an expiration time and whether burn-on-read should be enabled.
  Explain your reasoning for both suggestions.

  Message: {{{message}}}

  Your suggestions should be based on the content of the message. If the message contains sensitive information, suggest a shorter expiration time or burn-on-read.
  If the message is innocuous, suggest a longer expiration time or no expiration at all.

  Format your response as a JSON object with the following keys:
  - expirationTimeSuggestion: The suggested expiration time for the message. Must be one of: "1 minute", "1 hour", "1 day", "never".
  - burnOnReadSuggestion: Whether burn-on-read is suggested (true or false).
  - reasoning: The reasoning behind the expiration time and burn-on-read suggestions.

  Ensure the JSON object is valid and contains no additional keys or comments.
  Make sure to return valid JSON.
  Follow the schema description closely.
  `,
});

const suggestEphemeralSettingsFlow = ai.defineFlow(
  {
    name: 'suggestEphemeralSettingsFlow',
    inputSchema: SuggestEphemeralSettingsInputSchema,
    outputSchema: SuggestEphemeralSettingsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
