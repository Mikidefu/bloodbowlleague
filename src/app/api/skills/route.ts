import { NextResponse } from 'next/server';
import db from '@/lib/db';
import crypto from 'crypto';

// 1. Recupera tutte le skill
export async function GET() {
    try {
        const { rows: skills } = await db.execute('SELECT * FROM skills ORDER BY name ASC');
        return NextResponse.json(skills);
    } catch (error) {
        console.error('Error fetching skills:', error);
        return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 });
    }
}

// 2. Crea una nuova skill
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description, type, level } = body;

        // Validazione base
        if (!name || !type) {
            return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
        }

        const newSkillId = crypto.randomUUID();

        await db.execute({
            sql: `
        INSERT INTO skills (id, name, description, type, level)
        VALUES (?, ?, ?, ?, ?)
      `,
            args: [
                newSkillId,
                name,
                description || null,
                type,
                level || null
            ]
        });

        const { rows: newSkillRows } = await db.execute({
            sql: 'SELECT * FROM skills WHERE id = ?',
            args: [newSkillId]
        });

        return NextResponse.json(newSkillRows[0], { status: 201 });
    } catch (error) {
        console.error('Error creating skill:', error);
        return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
    }
}