import { NextRequest, NextResponse } from 'next/server';
import { listInventory, messagesTable, type Inventory, type Message } from '@/lib/server/db';
import type { Email } from '@/types';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
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
      const { data } = await messagesTable()
        .select('*')
        .eq('mailboxId', inv.mailboxId)
        .eq('rootDomain', inv.rootDomain)
        .order('receivedAt', { ascending: false })
        .limit(5);
      emails = (data ?? []).map((m) => ({
        id: (m as Message).id,
        from: (m as Message).from || '',
        to: (m as Message).to || '',
        subject: (m as Message).subject || '',
        date: new Date((m as Message).receivedAt).toISOString(),
        listUnsubscribe: (m as Message).listUnsubscribe,
        listUnsubscribePost: (m as Message).listUnsubscribePost,
      }));
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
