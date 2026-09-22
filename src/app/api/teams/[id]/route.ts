// src/app/api/teams/[id]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { recalcSppStatement } from '@/lib/spp';
import { uploadTeamLogo, UploadError } from '@/lib/upload';
import { CoachInputError, resolveCoachInput } from '@/lib/coaches';
import { getActiveSeason, seasonStatusSql } from '@/lib/seasons';
import { LIMITS } from '@/lib/leagueRules';
import { favouredOptions, getRoster } from '@/lib/rosters';
import { computeTeamValue } from '@/lib/teamValue';
import { toPlayer } from '@/lib/players';
import { postgamePhase } from '@/lib/postgame';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Recuperiamo la squadra e i giocatori in parallelo
    const [teamRes, playersRes] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [id] }),
      db.execute({ sql: 'SELECT * FROM players WHERE team_id = ? ORDER BY created_at ASC', args: [id] })
    ]);

    const team = teamRes.rows[0];
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    // 2. Recuperiamo tutte le skill associate ai giocatori di QUESTA squadra
    // Facciamo una JOIN tra skills, la tabella ponte, e i players di questo team
    const injuriesRes = await db.execute({
      sql: 'SELECT i.player_id, i.result, i.stat, i.stat_applied FROM player_injuries i JOIN players p ON p.id = i.player_id WHERE p.team_id = ?',
      args: [id]
    });

    const skillsRes = await db.execute({
      sql: `
        SELECT sp.player_id, s.*
        FROM skills s
        JOIN skills_players sp ON s.id = sp.skill_id
        JOIN players p ON p.id = sp.player_id
        WHERE p.team_id = ?
      `,
      args: [id]
    });

    // 3. Ogni riga diventa un Player tipizzato (toPlayer normalizza bandiere e caratteristiche)
    //    con le sue skill e il numero di Lasting Injury subiti.
    const mappedPlayers = playersRes.rows.map(p => toPlayer(p, {
      skills: skillsRes.rows.filter(s => s.player_id === p.id),
      lasting_injuries: injuriesRes.rows.filter(i => i.player_id === p.id && i.result === 'LI').length,
    }));

    // Sequenza post-partita ancora aperta: partite applicate con Expensive Mistakes da tirare
    const { rows: pending } = await db.execute({
      sql: `
        SELECT m.id AS match_id, m.round, m.match_type, r.winnings, r.df_change, r.mistake_result,
               CASE WHEN m.home_team_id = ? THEN ta.name ELSE th.name END AS opponent_name
        FROM match_team_reports r
        JOIN matches m ON m.id = r.match_id
        JOIN teams th ON th.id = m.home_team_id
        JOIN teams ta ON ta.id = m.away_team_id
        WHERE r.team_id = ? AND m.rules_applied = 1 AND r.mistake_result IS NULL
        ORDER BY m.round
      `,
      args: [id, id]
    });

    // Storico partecipazioni: stagione e allenatore (la prima riga è la più recente)
    const { rows: history } = await db.execute({
      sql: `
        SELECT s.id AS season_id, s.number AS season_number, s.name AS season_name, ${seasonStatusSql('s')} AS season_status,
               st.coach_id, c.name AS coach_name
        FROM season_teams st
        JOIN seasons s ON s.id = st.season_id
        LEFT JOIN coaches c ON c.id = st.coach_id
        WHERE st.team_id = ?
        ORDER BY s.number DESC
      `,
      args: [id]
    });
    const activeEntry = history.find(h => h.season_status === 'active');

    return NextResponse.json({
      ...team,
      ...computeTeamValue(team, mappedPlayers),
      pending_postgame: pending,
      postgame_phase: (await postgamePhase(id)).phase,
      players: mappedPlayers,
      in_active_season: !!activeEntry,
      coach_id: activeEntry?.coach_id ?? history[0]?.coach_id ?? null,
      coach_name: activeEntry?.coach_name ?? history[0]?.coach_name ?? null,
      season_history: history
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Failed to fetch team details' }, { status: 500 });
  }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();

    const name = formData.get('name')?.toString() || null;
    let logo_url = formData.get('logo_url')?.toString() || null;
    const primary_color = formData.get('primary_color')?.toString() || null;
    const secondary_color = formData.get('secondary_color')?.toString() || null;

    const rerolls = formData.has('rerolls') ? parseInt(formData.get('rerolls') as string, 10) : null;
    const reroll_cost = formData.has('reroll_cost') ? parseInt(formData.get('reroll_cost') as string, 10) : null;
    const cheerleaders = formData.has('cheerleaders') ? parseInt(formData.get('cheerleaders') as string, 10) : null;
    const assistant_coaches = formData.has('assistant_coaches') ? parseInt(formData.get('assistant_coaches') as string, 10) : null;
    const fan_factor = formData.has('fan_factor') ? parseInt(formData.get('fan_factor') as string, 10) : null;
    const apothecary = formData.has('apothecary') ? (formData.get('apothecary') === 'true' ? 1 : 0) : null;
    const treasury = formData.has('treasury') ? parseInt(formData.get('treasury') as string, 10) : null;
    const bank = formData.has('bank') ? parseInt(formData.get('bank') as string, 10) : null;

    // Roster, League e Favoured of: si possono impostare per collegare una squadra creata prima dei roster
    const { rows: [current] } = await db.execute({ sql: 'SELECT roster, team_league, favoured_of FROM teams WHERE id = ?', args: [id] });
    if (!current) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const rosterKey = formData.has('roster') ? formData.get('roster')?.toString() || null : (current.roster as string | null);
    const roster = getRoster(rosterKey);
    if (rosterKey && !roster) return NextResponse.json({ error: 'Unknown Team Roster' }, { status: 400 });
    const teamLeague = formData.has('team_league') ? formData.get('team_league')?.toString() || null : (current.team_league as string | null);
    if (roster && teamLeague && !roster.leagues.includes(teamLeague as never)) {
      return NextResponse.json({ error: `${roster.name} teams cannot play in ${teamLeague}` }, { status: 400 });
    }
    const favouredOf = formData.has('favoured_of') ? formData.get('favoured_of')?.toString() || null : (current.favoured_of as string | null);
    const favouredChoices = favouredOptions(roster, teamLeague);
    if (favouredOf && !favouredChoices.includes(favouredOf)) {
      return NextResponse.json({ error: `Favoured of ${favouredOf} is not an option for this team` }, { status: 400 });
    }

    // Roster, League e Favoured of si scelgono con la Team Draft List e non si cambiano più (pp. 152, 154).
    // Da vuoto si possono sempre impostare (squadre create prima dei roster); una scelta già fatta
    // si corregge solo finché la squadra non ha giocato.
    const changed = [
      ['Team Roster', current.roster, rosterKey],
      ['League', current.team_league, teamLeague],
      ['Favoured of', current.favoured_of, favouredOf],
    ].filter(([, before, after]) => before && before !== after).map(([label]) => label);
    if (changed.length) {
      const { rows: [played] } = await db.execute({
        sql: 'SELECT 1 FROM matches WHERE is_played = 1 AND (home_team_id = ? OR away_team_id = ?) LIMIT 1',
        args: [id, id],
      });
      if (played) {
        return NextResponse.json({ error: `${changed.join(', ')} cannot be changed once the team has played (pp. 152, 154)` }, { status: 409 });
      }
    }

    // Limiti del regolamento (pp. 90-91)
    const outOfRange = (value: number | null, min: number, max: number) => value !== null && (Number.isNaN(value) || value < min || value > max);
    const rangeErrors = [
      outOfRange(rerolls, 0, LIMITS.maxRerolls) && `Team Re-rolls: 0-${LIMITS.maxRerolls}`,
      outOfRange(assistant_coaches, 0, LIMITS.maxAssistantCoaches) && `Assistant Coaches: 0-${LIMITS.maxAssistantCoaches}`,
      outOfRange(cheerleaders, 0, LIMITS.maxCheerleaders) && `Cheerleaders: 0-${LIMITS.maxCheerleaders}`,
      outOfRange(fan_factor, LIMITS.dedicatedFansMin, LIMITS.dedicatedFansMax) && `Dedicated Fans: ${LIMITS.dedicatedFansMin}-${LIMITS.dedicatedFansMax}`,
      outOfRange(treasury, 0, Number.MAX_SAFE_INTEGER) && 'Treasury cannot be negative',
      roster && apothecary === 1 && !roster.apothecary && `${roster.name} teams cannot hire an Apothecary`,
    ].filter(Boolean);
    if (rangeErrors.length) return NextResponse.json({ error: rangeErrors.join(' · ') }, { status: 400 });

    const logoFile = formData.get('logo_file') as File | null;

    // Integrazione Vercel Blob per la modifica del logo
    if (logoFile && logoFile.size > 0) {
      logo_url = await uploadTeamLogo(logoFile);
    }

    // Cambio allenatore: vale per la stagione attiva (le stagioni concluse mantengono il loro allenatore)
    const statements = [];
    if (formData.has('coach_id') || formData.has('new_coach_name')) {
      const activeSeason = await getActiveSeason();
      const { rows: [enrollment] } = activeSeason
        ? await db.execute({ sql: 'SELECT 1 FROM season_teams WHERE season_id = ? AND team_id = ?', args: [activeSeason.id, id] })
        : { rows: [] };
      if (!activeSeason || !enrollment) {
        return NextResponse.json({ error: 'The team is not taking part in the active season: its coach cannot be changed.' }, { status: 409 });
      }
      const coach = await resolveCoachInput({
        coach_id: formData.get('coach_id')?.toString(),
        new_coach_name: formData.get('new_coach_name')?.toString(),
      });
      if (coach.statement) statements.push(coach.statement);
      statements.push({
        sql: 'UPDATE season_teams SET coach_id = ? WHERE season_id = ? AND team_id = ?',
        args: [coach.coachId, activeSeason.id, id]
      });
    }

    statements.push({
      sql: `
        UPDATE teams
        SET name = COALESCE(?, name),
            logo_url = COALESCE(?, logo_url),
            primary_color = COALESCE(?, primary_color),
            secondary_color = COALESCE(?, secondary_color),
            rerolls = COALESCE(?, rerolls),
            reroll_cost = COALESCE(?, reroll_cost),
            cheerleaders = COALESCE(?, cheerleaders),
            assistant_coaches = COALESCE(?, assistant_coaches),
            fan_factor = COALESCE(?, fan_factor),
            apothecary = COALESCE(?, apothecary),
            treasury = COALESCE(?, treasury),
            bank = COALESCE(?, bank),
            roster = ?,
            team_league = ?,
            favoured_of = ?
        WHERE id = ?
      `,
      args: [
        name, logo_url, primary_color, secondary_color,
        rerolls, roster ? roster.rerollCost : reroll_cost, cheerleaders, assistant_coaches, fan_factor, apothecary, treasury, bank,
        roster?.key ?? null, roster ? teamLeague : null, favouredChoices.length ? favouredOf : null,
        id
      ]
    });
    await db.batch(statements, 'write');

    const { rows: updatedTeamRows } = await db.execute({
      sql: 'SELECT * FROM teams WHERE id = ?',
      args: [id]
    });

    return NextResponse.json(updatedTeamRows[0]);
  } catch (error) {
    if (error instanceof UploadError || error instanceof CoachInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Le foreign key sono attive e "matches" non ha ON DELETE CASCADE:
    // prima vanno eliminate le partite della squadra (e le loro statistiche).
    const { rows: opponentsToRecalc } = await db.execute({
      sql: `
        SELECT DISTINCT s.player_id
        FROM player_stats s
        JOIN matches m ON m.id = s.match_id
        JOIN players p ON p.id = s.player_id
        WHERE (m.home_team_id = ? OR m.away_team_id = ?) AND p.team_id <> ?
      `,
      args: [id, id, id]
    });

    const statements = [
      {
        sql: 'DELETE FROM player_stats WHERE match_id IN (SELECT id FROM matches WHERE home_team_id = ? OR away_team_id = ?)',
        args: [id, id]
      },
      { sql: 'DELETE FROM matches WHERE home_team_id = ? OR away_team_id = ?', args: [id, id] },
      // Giocatori, loro statistiche residue e skill vengono rimossi in cascata
      { sql: 'DELETE FROM teams WHERE id = ?', args: [id] },
      // Gli avversari perdono gli SPP guadagnati contro questa squadra
      ...opponentsToRecalc.map(p => recalcSppStatement(String(p.player_id))),
    ];

    await db.batch(statements, 'write');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}