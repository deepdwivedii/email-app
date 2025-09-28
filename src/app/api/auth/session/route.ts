import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAdminApp } from '@/lib/server/firebase-admin';

export async function POST(req: NextRequest) {
  const authorization = req.headers.get('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const idToken = authorization.split('Bearer ')[1];
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    try {
      const sessionCookie = await getAuth(firebaseAdminApp).createSessionCookie(idToken, { expiresIn });
      const isProduction = req.nextUrl.origin.startsWith('https://');
      const options = {
        name: '__session',
        value: sessionCookie,
        maxAge: expiresIn,
        httpOnly: true,
        secure: isProduction, // Only secure in production (HTTPS)
        path: '/',
        sameSite: 'lax' as const
      };
      const response = NextResponse.json({ status: 'success' });
      response.cookies.set(options);
      return response;
    } catch (error) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
  }
  return NextResponse.json({ status: 'error', message: 'Forbidden' }, { status: 403 });
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ status: 'success' });
  response.cookies.set({
    name: '__session',
    value: '',
    maxAge: -1,
    path: '/',
  });
  return response;
}
