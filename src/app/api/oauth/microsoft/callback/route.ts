import { NextRequest, NextResponse } from 'next/server';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { encryptJson } from '@/lib/server/crypto';
import { upsertMailbox } from '@/lib/server/db';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/oauth/microsoft/callback`;
    const clientId = process.env.MS_OAUTH_CLIENT_ID as string;
    const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET as string;
    const code = req.nextUrl.searchParams.get('code') as string;
    if (!clientId || !clientSecret || !code) {
      return NextResponse.redirect(`${origin}/connect?error=oauth_missing_params`);
    }

    const pca = new ConfidentialClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
        clientSecret,
      },
    });

    const tokenResponse = await pca.acquireTokenByCode({
      code,
      redirectUri,
      scopes: ['https://graph.microsoft.com/Mail.Read', 'offline_access'],
    });

    if (!tokenResponse?.accessToken) throw new Error('Token exchange failed');

    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
    });
    if (!meRes.ok) throw new Error('Failed to fetch Microsoft profile');
    const me = await meRes.json();
    const email = (me.mail || me.userPrincipalName) as string;

    const tokenBlobEncrypted = encryptJson({
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresOn: tokenResponse.expiresOn?.toISOString?.() ?? null,
    });

    const saved = await upsertMailbox({
      provider: 'outlook',
      email,
      tokenBlobEncrypted,
      connectedAt: Date.now(),
      lastSyncAt: Date.now(),
    });

    const resp = NextResponse.redirect(`${origin}/connect?connected=outlook`);
    const secure = origin.startsWith('https://');
    resp.cookies.set('mb', saved.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return resp;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${req.nextUrl.origin}/connect?error=oauth_error`);
  }
}