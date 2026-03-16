import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Find players who have stats in this match so we can recalculate their SPP after deletion
    const playersToRecalc = db.prepare('SELECT DISTINCT player_id FROM player_stats WHERE match_id = ?').all(id) as { player_id: string }[];

    // the player_stats cascade delete automatically
    const stmt = db.prepare('DELETE FROM matches WHERE id = ?');
    stmt.run(id);

    // Recalculate lifetime SPP for affected players
    const recalcStmt = db.prepare(`
      UPDATE players 
      SET spp = (SELECT COALESCE(SUM(spp_earned), 0) FROM player_stats WHERE player_id = ?)
      WHERE id = ?
    `);
    
    db.transaction(() => {
      for (const p of playersToRecalc) {
        recalcStmt.run(p.player_id, p.player_id);
      }
    })();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting match:', error);
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}
