import { NextRequest, NextResponse } from 'next/server';
import { listInventory, messagesCol, type Inventory, type Message } from '@/lib/server/db';
import type { Email } from '@/types';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

async function getUserIdFromSessionCookie(req: NextRequest) {
  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) return null;
  try {
    const decodedToken = await getAuth(firebaseAdminApp).verifySessionCookie(sessionCookie, true);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromSessionCookie(req);
  if (!userId) {
    // Return empty inventory if not logged in.
    // The UI will guide them to login/signup.
    return NextResponse.json({ domains: [] });
  }

  const { searchParams } = new URL(req.url);
  const hasUnsubParam = searchParams.get('hasUnsub');
  const lastSeenAfter = searchParams.get('lastSeenAfter');

  const filters: Parameters<typeof listInventory>[0] = { userId };
  if (hasUnsubParam !== null) filters.hasUnsub = hasUnsubParam === 'true';
  if (lastSeenAfter) filters.lastSeenAfter = Number(lastSeenAfter);

  let items: Inventory[] = [];
  try {
    items = await listInventory(filters);
  } catch (e) {
    console.warn('Inventory query failed:', (e as Error)?.message);
  }

  if (!items.length) {
    // Return empty if no inventory found for the user.
    // This prompts the dashboard to show the "Connect Mailbox" card.
    return NextResponse.json({ domains: [] });
  }

  const domains = await Promise.all(items.map(async (inv) => {
    let emails: Email[] = [];
    try {
      const msgsSnap = await messagesCol()
        .where('mailboxId', '==', inv.mailboxId)
        .where('rootDomain', '==', inv.rootDomain)
        .orderBy('receivedAt', 'desc')
        .limit(5)
        .get();
      emails = msgsSnap.docs.map((d) => {
        const m = d.data() as Message;
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
