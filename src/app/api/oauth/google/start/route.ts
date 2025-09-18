import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

const scopes = [
  'https://www.googleapis.com/auth/gmail.metadata',
  'openid',
  'email',
];

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/google/callback`;
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing Google OAuth secrets' }, { status: 500 });
  }
  const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    include_granted_scopes: true,
  });
  return NextResponse.redirect(url, { status: 302 });
}

export async function POST(req: NextRequest) {
  return GET(req);
}