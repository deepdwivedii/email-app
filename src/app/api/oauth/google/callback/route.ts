import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { encryptJson } from '@/lib/server/crypto';
import { upsertMailbox, upsertEmailIdentity } from '@/lib/server/db';
import { getUserId } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const userId = await getUserId(req);
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
    let errCode = 'token_exchange';
    const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
    const { tokens } = await client.getToken(code);

    errCode = 'profile_fetch';
    const accessToken = tokens.access_token as string;
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error('Failed to fetch Gmail profile');
    const profile = await profileRes.json();
    const emailAddress = profile.emailAddress as string;
    const historyId = profile.historyId ? String(profile.historyId) : undefined;

    errCode = 'upsert_mailbox';
    const tokenBlobEncrypted = encryptJson(tokens);
    const saved = await upsertMailbox({
      userId,
      provider: 'gmail',
      email: emailAddress,
      tokenBlobEncrypted,
      cursor: historyId,
      connectedAt: Date.now(),
      lastSyncAt: undefined,
    });
    errCode = 'upsert_identity';
    await upsertEmailIdentity({
      userId,
      email: emailAddress,
      provider: 'gmail',
      mailboxId: saved.id,
      verifiedAt: Date.now(),
    });

    errCode = 'set_cookie_redirect';
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
    const err = e as any;
    const msg = (err?.message as string) || String(err);
    const pgCode = err?.code || err?.status || undefined;
    const details = err?.details || err?.hint || undefined;
    console.error('Google OAuth callback error', { msg, pgCode, details });
    const coarse = msg.includes('profile') ? 'profile_fetch' : 'token_or_upsert_error';
    const codeParam = encodeURIComponent(pgCode ? `supabase_${pgCode}` : coarse);
    return NextResponse.redirect(`${req.nextUrl.origin}/dashboard?error=oauth_error&code=${codeParam}`);
  }
}
