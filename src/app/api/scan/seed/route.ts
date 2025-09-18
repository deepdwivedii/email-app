import { NextRequest, NextResponse } from 'next/server';

// Placeholder endpoint to trigger an initial scan seed by date window.
// In production, this would iterate pages from providers and upsert headers.
export async function POST(req: NextRequest) {
  return NextResponse.json({ ok: true });
}