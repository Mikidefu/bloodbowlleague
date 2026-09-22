import { NextResponse } from 'next/server';
import { applyExpensiveMistakes, undoExpensiveMistakes } from '@/lib/matchRules';
import { lockedMatchResponse, ruleErrorResponse } from '@/lib/matchApi';

// Expensive Mistakes (p. 100), ultimo tiro del post-partita di una squadra.
// POST { team_id, roll, extra }  -> applica (extra: D3 per Minor Incident, 2D6 per Catastrophe)
// DELETE ?team=<id>              -> annulla, per correggere il referto
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const locked = await lockedMatchResponse(id);
    if (locked) return locked;

    const body = await request.json().catch(() => ({}));
    const outcome = await applyExpensiveMistakes(id, String(body.team_id ?? ''), body.roll, body.extra);
    return NextResponse.json({ success: true, ...outcome });
  } catch (error) {
    const ruleResponse = ruleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error('Error rolling Expensive Mistakes:', error);
    return NextResponse.json({ error: 'Failed to resolve Expensive Mistakes' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const locked = await lockedMatchResponse(id);
    if (locked) return locked;

    await undoExpensiveMistakes(id, new URL(request.url).searchParams.get('team') ?? '');
    return NextResponse.json({ success: true });
  } catch (error) {
    const ruleResponse = ruleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error('Error undoing Expensive Mistakes:', error);
    return NextResponse.json({ error: 'Failed to undo Expensive Mistakes' }, { status: 500 });
  }
}
