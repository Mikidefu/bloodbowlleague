import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, SESSION_MAX_AGE, checkPassword, createSessionToken, isAuthConfigured } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json({ error: 'Admin password not configured on the server' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    if (!checkPassword(password)) {
      // Piccolo ritardo per rallentare i tentativi a forza bruta
      await new Promise(resolve => setTimeout(resolve, 800));
      return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
