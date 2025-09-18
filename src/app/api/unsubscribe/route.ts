import { NextRequest, NextResponse } from 'next/server';

function parseListUnsubscribe(value: string | undefined) {
  if (!value) return { urls: [], mailtos: [] as string[] };
  const parts = value.split(',').map((s) => s.trim().replace(/^<|>$/g, ''));
  const urls = parts.filter((p) => p.startsWith('http://') || p.startsWith('https://'));
  const mailtos = parts.filter((p) => p.toLowerCase().startsWith('mailto:'));
  return { urls, mailtos };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const listUnsubscribe: string | undefined = body.listUnsubscribe;
    const listUnsubscribePost: string | undefined = body.listUnsubscribePost;

    const { urls, mailtos } = parseListUnsubscribe(listUnsubscribe);

    // RFC 8058 One-Click: prefer POST with List-Unsubscribe=One-Click header
    let attempted = false;
    for (const url of urls) {
      attempted = true;
      const res = await fetch(url, {
        method: listUnsubscribePost?.toLowerCase().includes('one-click') ? 'POST' : 'GET',
        headers: listUnsubscribePost?.toLowerCase().includes('one-click')
          ? { 'List-Unsubscribe': 'One-Click' }
          : undefined,
      });
      if (res.ok) return NextResponse.json({ status: 'ok', method: 'http', url });
    }

    if (!attempted && mailtos.length) {
      // In a real deployment, you would send an email with subject "unsubscribe"
      // For safety in demo, just acknowledge
      return NextResponse.json({ status: 'ack', method: 'mailto', to: mailtos[0] });
    }

    return NextResponse.json({ status: 'noop' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to process unsubscribe' }, { status: 500 });
  }
}