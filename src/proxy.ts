import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/auth';

// Le letture restano pubbliche; ogni scrittura sulle API richiede la sessione admin.
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const PUBLIC_WRITE_ROUTES = ['/api/auth/login', '/api/auth/logout'];

export function proxy(request: NextRequest) {
  if (READ_METHODS.includes(request.method)) return NextResponse.next();
  if (PUBLIC_WRITE_ROUTES.includes(request.nextUrl.pathname)) return NextResponse.next();

  if (!verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized: admin login required' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
