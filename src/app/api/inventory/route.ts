import { NextRequest, NextResponse } from 'next/server';
import { listInventory, messagesCol } from '@/lib/server/db';
import { aggregateEmailsByDomain, mockEmails } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hasUnsubParam = searchParams.get('hasUnsub');
  const lastSeenAfter = searchParams.get('lastSeenAfter');

  const filters: any = {};
  if (hasUnsubParam !== null) filters.hasUnsub = hasUnsubParam === 'true';
  if (lastSeenAfter) filters.lastSeenAfter = Number(lastSeenAfter);

  let items: any[] = [];
  try {
    items = await listInventory(filters);
  } catch (e) {
    // In local dev without Firestore credentials, fall back to mock data.
    console.warn('Inventory query failed, falling back to mock data:', (e as Error)?.message);
  }

  if (!items.length) {
    const domains = aggregateEmailsByDomain(mockEmails).map((d) => ({
      domain: d.domain,
      count: d.count,
      lastSeen: d.lastSeen,
      category: d.category,
      isUnsubscribed: d.isUnsubscribed,
      emails: d.emails,
      // No inventory id in mock mode
      inventoryId: undefined,
    }));
    return NextResponse.json({ domains });
  }

  // For each inventory item, fetch up to 5 recent messages to power UI actions
  const domains = await Promise.all(items.map(async (inv) => {
    let emails: any[] = [];
    try {
      const msgsSnap = await messagesCol()
        .where('mailboxId', '==', inv.mailboxId)
        .where('rootDomain', '==', inv.rootDomain)
        .orderBy('receivedAt', 'desc')
        .limit(5)
        .get();
      emails = msgsSnap.docs.map((d) => {
        const m = d.data() as any;
        return {
          id: m.id,
          from: m.from || '',
          to: m.to || '',
          subject: m.subject || '',
          date: new Date(m.receivedAt).toISOString(),
          listUnsubscribe: m.listUnsubscribe,
          listUnsubscribePost: m.listUnsubscribePost,
        };
      });
    } catch (err) {
      console.warn('Message fetch skipped for', inv.rootDomain, (err as Error)?.message);
    }

    return {
      domain: inv.rootDomain,
      count: inv.msgCount,
      lastSeen: new Date(inv.lastSeen).toISOString(),
      category: 'Other',
      isUnsubscribed: inv.status !== 'active',
      emails,
      inventoryId: inv.id,
      mailboxId: inv.mailboxId,
    };
  }));

  return NextResponse.json({ domains });
}