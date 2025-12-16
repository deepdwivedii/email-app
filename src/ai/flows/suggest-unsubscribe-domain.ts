'use server';

/**
 * @fileOverview An AI agent that suggests the most likely root domain of an email for unsubscribing.
 *
 * - suggestUnsubscribeDomain - A function that suggests the root domain.
 * - SuggestUnsubscribeDomainInput - The input type for the suggestUnsubscribeDomain function.
 * - SuggestUnsubscribeDomainOutput - The return type for the suggestUnsubscribeDomain function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestUnsubscribeDomainInputSchema = z.object({
  from: z
    .string()
    .describe('The From header of the email.'),
  to: z
    .string()
    .describe('The To header of the email.'),
  subject: z
    .string()
    .describe('The Subject header of the email.'),
  listUnsubscribe: z
    .string()
    .optional()
    .describe('The List-Unsubscribe header of the email, if present.'),
  existingSubscriptions: z
    .array(z.string())
    .describe('A list of root domains the user is already subscribed to.'),
});
export type SuggestUnsubscribeDomainInput = z.infer<typeof SuggestUnsubscribeDomainInputSchema>;

const SuggestUnsubscribeDomainOutputSchema = z.object({
  suggestedDomain: z
    .string()
    .describe('The suggested root domain for unsubscribing.'),
  confidence: z
    .number()
    .describe('A confidence score between 0 and 1 indicating the likelihood of the suggestion.'),
  reason: z
    .string()
    .describe('The reasoning behind the domain suggestion.'),
});
export type SuggestUnsubscribeDomainOutput = z.infer<typeof SuggestUnsubscribeDomainOutputSchema>;

export async function suggestUnsubscribeDomain(
  input: SuggestUnsubscribeDomainInput
): Promise<SuggestUnsubscribeDomainOutput> {
  return suggestUnsubscribeDomainFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestUnsubscribeDomainPrompt',
  input: {schema: SuggestUnsubscribeDomainInputSchema},
  output: {schema: SuggestUnsubscribeDomainOutputSchema},
  prompt: `You are an expert at identifying the root domain of email subscriptions.

  Given the following email headers and a list of existing subscriptions, determine the most likely root domain from which the email originated. Provide a confidence score and a reason for your suggestion.

  Email Headers:
  From: {{{from}}}
  To: {{{to}}}
  Subject: {{{subject}}}
  List-Unsubscribe: {{{listUnsubscribe}}}

  Existing Subscriptions:{{#each existingSubscriptions}} {{{this}}}{{#unless @last}},{{/unless}}{{/each}}

  Consider the following:
  *   The List-Unsubscribe header, if present, is the most reliable indicator.
  *   The From header often contains the domain, but can be misleading.
  *   The Subject may contain clues, but is less reliable.
  *   Existing subscriptions provide context for identifying potential sources.

  Format your response as a JSON object with "suggestedDomain", "confidence", and "reason" fields.
`,
});

const suggestUnsubscribeDomainFlow = ai.defineFlow(
  {
    name: 'suggestUnsubscribeDomainFlow',
    inputSchema: SuggestUnsubscribeDomainInputSchema,
    outputSchema: SuggestUnsubscribeDomainOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
