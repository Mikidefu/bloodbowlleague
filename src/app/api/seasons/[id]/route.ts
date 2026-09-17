import { NextResponse } from 'next/server';
import db from '@/lib/db';

// Rinomina una stagione
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Season name is required' }, { status: 400 });
    if (name.length > 60) return NextResponse.json({ error: 'Season name is too long (max 60 characters)' }, { status: 400 });

    const result = await db.execute({ sql: 'UPDATE seasons SET name = ? WHERE id = ?', args: [name, id] });
    if (result.rowsAffected === 0) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error renaming season:', error);
    return NextResponse.json({ error: 'Failed to rename season' }, { status: 500 });
  }
}
