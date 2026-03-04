import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import crypto from 'crypto';

const ActionSchema = z.object({
  type: z.enum(['bill', 'booking', 'follow_up', 'delivery', 'subscription', 'other']),
  title: z.string().max(200),
  due_at: z.string().datetime().nullable(),
  amount: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  action_url: z.string().url().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(400),
});

export type ActionItem = z.infer<typeof ActionSchema>;

const ResultSchema = z.object({
  results: z.array(
    z.object({
      message_id: z.string(),
      actions: z.array(ActionSchema),
    })
  ),
});

export type ActionExtractionResult = z.infer<typeof ResultSchema>;

const EmailInputSchema = z.object({
  messageId: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string(),
  listUnsubscribe: z.string().optional(),
  isFromSelf: z.boolean().optional(),
  knownBillerDomain: z.boolean().optional(),
  previouslyDismissedSameSender: z.boolean().optional(),
});

export type EmailForActionExtraction = z.infer<typeof EmailInputSchema>;

type ScoringContext = {
  subject?: string;
  body?: string;
  hasUnsubscribeHeader?: boolean;
  isFromSelf?: boolean;
  knownBillerDomain?: boolean;
  previouslyDismissedSameSender?: boolean;
};

export function cleanEmailBody(rawBody: string) {
  const original = rawBody || '';
  const lines = original.split(/\r?\n/);
  const cleanedLines: string[] = [];
  let skippingFooter = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!skippingFooter && /unsubscribe/i.test(trimmed)) {
      skippingFooter = true;
    }
    if (trimmed.startsWith('>')) {
      continue;
    }
    if (/^on .+ wrote:$/i.test(trimmed)) {
      continue;
    }
    if (skippingFooter) {
      continue;
    }
    cleanedLines.push(line);
  }
  let text = cleanedLines.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]{3,}/g, ' ');
  text = text.trim();
  if (text.length > 8000) {
    text = text.slice(0, 8000);
  }
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  return {text, hash};
}

export function scoreCandidateEmail(ctx: ScoringContext) {
  let score = 0;
  const subject = (ctx.subject || '').toLowerCase();
  const body = (ctx.body || '').toLowerCase();
  if (subject.match(/\b(invoice|payment|due|bill)\b/)) {
    score += 0.4;
  }
  if (subject.match(/\b(reservation|confirmation|booking)\b/)) {
    score += 0.35;
  }
  if (ctx.knownBillerDomain) {
    score += 0.3;
  }
  if (body.match(/(\$|€|aed|\d+[.,]\d{2})/i)) {
    score += 0.25;
  }
  if (body.match(/due (by|on|before) [\w\s,]+/i)) {
    score += 0.2;
  }
  if (ctx.hasUnsubscribeHeader) {
    score -= 0.25;
  }
  if (ctx.isFromSelf) {
    score -= 1;
  }
  if (ctx.previouslyDismissedSameSender) {
    score -= 0.3;
  }
  if (score < 0) {
    return 0;
  }
  if (score > 1) {
    return 1;
  }
  return score;
}

const ExtractActionsPromptInput = z.object({
  emails: z.array(
    z.object({
      message_id: z.string(),
      subject: z.string().optional(),
      from: z.string().optional(),
      body: z.string(),
    })
  ),
});

const extractActionsPrompt = ai.definePrompt({
  name: 'extractEmailActionsPrompt',
  input: {schema: ExtractActionsPromptInput},
  output: {schema: ResultSchema},
  prompt:
    'You are an email action-item extractor. You process batches of emails and return structured JSON only. ' +
    'For each email, extract zero or more actions the user might need to take. Follow this schema exactly: ' +
    '{ "results": [ { "message_id": string, "actions": [ { "type": "bill" | "booking" | "follow_up" | "delivery" | "subscription" | "other", "title": string, "due_at": ISO-8601 string or null, "amount": number or null, "currency": 3-letter code or null, "action_url": string or null, "confidence": number between 0 and 1, "reasoning": string } ] } ] }. ' +
    'Do not guess amounts or dates. Leave them null if unclear. Never invent actions that are not clearly implied. ' +
    'One action per distinct obligation. If no actions are present for an email, return an empty actions array for that message.',
});

export async function extractEmailActions(emails: EmailForActionExtraction[]): Promise<ActionExtractionResult> {
  if (!emails.length) {
    return {results: []};
  }
  const prepared = emails.map(raw => {
    const email = EmailInputSchema.parse(raw);
    const cleaned = cleanEmailBody(email.body);
    const score = scoreCandidateEmail({
      subject: email.subject,
      body: cleaned.text,
      hasUnsubscribeHeader: !!email.listUnsubscribe,
      isFromSelf: email.isFromSelf,
      knownBillerDomain: email.knownBillerDomain,
      previouslyDismissedSameSender: email.previouslyDismissedSameSender,
    });
    return {
      email,
      cleaned,
      score,
    };
  });
  const highPriority = prepared.filter(p => p.score >= 0.5);
  const lowPriority = prepared.filter(p => p.score >= 0.3 && p.score < 0.5);
  const toProcess = highPriority.concat(lowPriority);
  if (!toProcess.length) {
    return {results: []};
  }
  const batchDocs = toProcess.map(p => ({
    message_id: p.email.messageId,
    subject: p.email.subject || '',
    from: p.email.from || '',
    body: p.cleaned.text,
  }));
  const {output} = await extractActionsPrompt({emails: batchDocs});
  const raw = output || {results: []};
  const validIds = new Set(batchDocs.map(d => d.message_id));
  const filteredResults =
    raw.results?.filter(r => validIds.has(r.message_id)) || [];
  return {results: filteredResults};
}
