import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { encryptJson } from '@/lib/server/crypto';
import { upsertMailbox, upsertEmailIdentity } from '@/lib/server/db';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';

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
  try {
    const origin = req.nextUrl.origin;
    const userId = await getUserIdFromSessionCookie(req);
    if (!userId) {
      return NextResponse.redirect(`${origin}/login?error=unauthorized`);
    }

    const redirectUri = `${origin}/api/oauth/google/callback`;
    const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string;
    const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string;
    const code = req.nextUrl.searchParams.get('code');
    if (!clientId || !clientSecret || !code) {
      return NextResponse.redirect(`${origin}/dashboard?error=oauth_missing_params`);
    }
    const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
    const { tokens } = await client.getToken(code);

    const accessToken = tokens.access_token as string;
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error('Failed to fetch Gmail profile');
    const profile = await profileRes.json();
    const emailAddress = profile.emailAddress as string;
    const historyId = profile.historyId ? String(profile.historyId) : undefined;

    const tokenBlobEncrypted = encryptJson(tokens);
    const saved = await upsertMailbox({
      userId,
      provider: 'gmail',
      email: emailAddress,
      tokenBlobEncrypted,
      cursor: historyId,
      connectedAt: Date.now(),
      lastSyncAt: Date.now(),
    });
    await upsertEmailIdentity({
      userId,
      email: emailAddress,
      provider: 'gmail',
      mailboxId: saved.id,
      verifiedAt: Date.now(),
    });

    const resp = NextResponse.redirect(`${origin}/dashboard?connected=gmail`);
    const secure = origin.startsWith('https://');
    // Set mailbox ID cookie to scope sync operations
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
    return NextResponse.redirect(`${req.nextUrl.origin}/dashboard?error=oauth_error`);
  }
}
