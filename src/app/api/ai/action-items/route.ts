import { NextRequest, NextResponse } from 'next/server';
import { extractEmailActions, type EmailForActionExtraction } from '@/ai/flows/email-action-items';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emailsInput = Array.isArray(body?.emails)
      ? (body.emails as unknown[])
      : [];
    const emails: EmailForActionExtraction[] = emailsInput.map(item => {
      const e = item as Record<string, unknown>;
      return {
        messageId: String(e.messageId ?? ''),
        from: typeof e.from === 'string' ? e.from : undefined,
        to: typeof e.to === 'string' ? e.to : undefined,
        subject: typeof e.subject === 'string' ? e.subject : undefined,
        body: typeof e.body === 'string' ? e.body : '',
        listUnsubscribe:
          typeof e.listUnsubscribe === 'string' ? e.listUnsubscribe : undefined,
        isFromSelf: Boolean(e.isFromSelf),
        knownBillerDomain: Boolean(e.knownBillerDomain),
        previouslyDismissedSameSender: Boolean(
          e.previouslyDismissedSameSender
        ),
      };
    });
    if (!emails.length) {
      return NextResponse.json({ results: [] });
    }
    const result = await extractEmailActions(emails);
    return NextResponse.json(result);
  } catch (e) {
    console.error('AI action-items error', e);
    return NextResponse.json(
      { error: 'Failed to extract actions' },
      { status: 500 }
    );
  }
}
