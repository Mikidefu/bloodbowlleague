import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const isAdmin = verifySessionToken(cookieStore.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ isAdmin });
}
