import { NextRequest, NextResponse } from 'next/server';
import { listInventory } from '@/lib/server/db';
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
    }));
    return NextResponse.json({ domains });
  }

  const domains = items.map((inv) => ({
    domain: inv.rootDomain,
    count: inv.msgCount,
    lastSeen: new Date(inv.lastSeen).toISOString(),
    category: 'Other',
    isUnsubscribed: inv.status !== 'active',
    emails: [],
  }));

  return NextResponse.json({ domains });
}