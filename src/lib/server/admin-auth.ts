import { NextRequest } from 'next/server';

export function requireAdmin(req: NextRequest) {
  const token = process.env.ADMIN_APP_TOKEN;
  const header = req.headers.get('x-admin-token');
  if (!token || header !== token) {
    const error = new Error('Unauthorized');
    throw error;
  }
}

