import { NextRequest, NextResponse } from 'next/server';
import { ConfidentialClientApplication } from '@azure/msal-node';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/microsoft/callback`;
  const clientId = process.env.MS_OAUTH_CLIENT_ID as string;
  const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET as string;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing Microsoft OAuth secrets' }, { status: 500 });
  }
  const pca = new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common',
      clientSecret,
    },
  });
  const scopes = ['https://graph.microsoft.com/Mail.Read', 'offline_access', 'openid', 'email', 'profile'];
  const url = await pca.getAuthCodeUrl({
    scopes,
    redirectUri,
    prompt: 'consent',
  });
  return NextResponse.redirect(url, { status: 302 });
}

export async function POST(req: NextRequest) {
  return GET(req);
}