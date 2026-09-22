import { NextResponse } from 'next/server';
import { applyPregame } from '@/lib/matchRules';
import { lockedMatchResponse, ruleErrorResponse } from '@/lib/matchApi';

// Pre-partita di League Play (pp. 44-45, 94): Fan Factor, Journeymen, incentivi e Petty Cash.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const locked = await lockedMatchResponse(id);
    if (locked) return locked;

    await applyPregame(id, await request.json());
    return NextResponse.json({ success: true });
  } catch (error) {
    const ruleResponse = ruleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error('Error saving pre-game:', error);
    return NextResponse.json({ error: 'Failed to save the pre-game sequence' }, { status: 500 });
  }
}
