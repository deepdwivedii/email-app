import { NextRequest, NextResponse } from 'next/server';
import { suggestUnsubscribeDomain } from '@/ai/flows/suggest-unsubscribe-domain';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, to, subject, listUnsubscribe, existingSubscriptions } = body || {};
    if (typeof from !== 'string' || typeof to !== 'string' || typeof subject !== 'string') {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const result = await suggestUnsubscribeDomain({
      from,
      to,
      subject,
      listUnsubscribe,
      existingSubscriptions: Array.isArray(existingSubscriptions) ? existingSubscriptions : [],
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('AI suggest-domain error', e);
    return NextResponse.json({ error: 'Failed to get suggestion' }, { status: 500 });
  }
}