import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/auth';

// Le letture restano pubbliche; ogni scrittura sulle API richiede la sessione admin.
const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const PUBLIC_WRITE_ROUTES = ['/api/auth/login', '/api/auth/logout', '/api/live/join'];
// Partita dal vivo: scrivono anche i telefoni abbinati, e ognuna di queste route verifica da sé
// admin o token di squadra (writerOf in src/lib/live/api.ts), push compreso (abbonamento alle notifiche).
// Avvio, chiusura e scollegamento restano solo admin.
const LIVE_WRITE_ROUTE = /^\/api\/live\/[^/]+\/(events|kickoff|leave|push)$/;

export function proxy(request: NextRequest) {
  if (READ_METHODS.includes(request.method)) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (PUBLIC_WRITE_ROUTES.includes(pathname) || LIVE_WRITE_ROUTE.test(pathname)) return NextResponse.next();

  if (!verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'Unauthorized: admin login required' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
