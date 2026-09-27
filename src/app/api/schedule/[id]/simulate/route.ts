import { NextResponse } from 'next/server';
import { simulateResult } from '@/lib/matchRules';
import { lockedMatchResponse, ruleErrorResponse } from '@/lib/matchApi';

// Referto simulato di una Non classificata: stessi controlli e conti del campionato (SPP, incassi, Dedicated Fans,
// infortuni), ma non si scrive niente. Il corpo è quello del PUT /api/schedule/[id]. Solo admin (src/proxy.ts).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const locked = await lockedMatchResponse(id);
    if (locked) return locked;

    const simulation = await simulateResult(id, await request.json().catch(() => ({})));
    return NextResponse.json({ simulation });
  } catch (error) {
    const ruleResponse = ruleErrorResponse(error);
    if (ruleResponse) return ruleResponse;
    console.error('Error simulating the match report:', error);
    return NextResponse.json({ error: 'Failed to simulate the match report' }, { status: 500 });
  }
}
