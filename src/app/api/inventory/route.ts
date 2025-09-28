import { NextRequest, NextResponse } from 'next/server';
import { listInventory, mailboxesCol, messagesCol } from '@/lib/server/db';
import { aggregateEmailsByDomain, mockEmails } from '@/lib/data';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

async function getUserIdFromSessionCookie(req: NextRequest) {
  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decodedToken = await getAuth(firebaseAdminApp).verifySessionCookie(sessionCookie, true);
    return decodedToken.uid;
  } catch (error) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromSessionCookie(req);
  if (!userId) {
    // Return empty inventory if not logged in, or fallback to mock data
    const domains = aggregateEmailsByDomain(mockEmails).map((d) => ({
      domain: d.domain,
      count: d.count,
      lastSeen: d.lastSeen,
      category: d.category,
      isUnsubscribed: d.isUnsubscribed,
      emails: d.emails,
      inventoryId: undefined,
    }));
    return NextResponse.json({ domains });
  }

  const { searchParams } = new URL(req.url);
  const hasUnsubParam = searchParams.get('hasUnsub');
  const lastSeenAfter = searchParams.get('lastSeenAfter');

  const filters: any = { userId };
  if (hasUnsubParam !== null) filters.hasUnsub = hasUnsubParam === 'true';
  if (lastSeenAfter) filters.lastSeenAfter = Number(lastSeenAfter);

  let items: any[] = [];
  try {
    items = await listInventory(filters);
  } catch (e) {
    console.warn('Inventory query failed:', (e as Error)?.message);
  }

  if (!items.length) {
    // Return empty if no inventory found for the user.
    return NextResponse.json({ domains: [] });
  }

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
