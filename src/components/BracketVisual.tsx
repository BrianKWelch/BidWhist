import React from 'react';
import type { BracketMatch, BracketTeam } from '@/contexts/AppContext';
import { getVisualPos } from '@/lib/bracketUtils';

// ── Layout constants ──────────────────────────────────────────────────────────
const MATCH_H = 58;   // was 78  (~75%)
const MATCH_W = 160;  // was 215 (~75%)
const CONN_W  = 36;   // was 50  (~72%)
const UNIT    = 75;   // was 100 (75%)

const LINE_COLOR = '#475569';

// ── Shared geometry ───────────────────────────────────────────────────────────
const slotH   = (round: number) => Math.pow(2, round - 1) * UNIT;
const centerY = (round: number, mappedVisPos: number) =>
  mappedVisPos * slotH(round) + slotH(round) / 2;
const topY    = (round: number, mappedVisPos: number) =>
  centerY(round, mappedVisPos) - MATCH_H / 2;

const getRoundName = (round: number, numRounds: number): string => {
  if (round === numRounds)     return 'Final';
  if (round === numRounds - 1) return 'Semi-Final';
  if (round === numRounds - 2) return 'Quarter-Final';
  return `Round ${round}`;
};

// ── Team row ─────────────────────────────────────────────────────────────────
const TeamRow: React.FC<{ team?: BracketTeam; isWinner: boolean; score?: number }> = ({
  team, isWinner, score,
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '2px 7px', flex: 1, minHeight: 0, overflow: 'hidden',
    backgroundColor: isWinner ? '#dcfce7' : 'transparent',
  }}>
    {team ? (
      <>
        <span style={{ fontSize: 8, color: '#9ca3af', minWidth: 14, fontWeight: 600 }}>
          #{team.seed}
        </span>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#111827', minWidth: 18 }}>
          {team.teamNumber}
        </span>
        <span style={{
          fontSize: 9, color: '#374151', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {team.teamName}
        </span>
        {typeof score === 'number' && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: isWinner ? '#16a34a' : '#9ca3af',
            minWidth: 16, textAlign: 'right',
          }}>
            {score}
          </span>
        )}
        {isWinner && <span style={{ fontSize: 9, color: '#16a34a', marginLeft: 1 }}>✓</span>}
      </>
    ) : (
      <span style={{ fontSize: 8, color: '#d1d5db', fontStyle: 'italic' }}>TBD</span>
    )}
  </div>
);

// ── Match card ────────────────────────────────────────────────────────────────
const MatchCard: React.FC<{ match: BracketMatch; x: number; y: number }> = ({ match, x, y }) => {
  const t1Win  = !!match.winner && match.winner.teamId === match.team1?.teamId;
  const t2Win  = !!match.winner && match.winner.teamId === match.team2?.teamId;
  const hasWin = t1Win || t2Win;
  return (
    <div style={{
      position: 'absolute', top: y, left: x,
      width: MATCH_W, height: MATCH_H,
      border: `1.5px solid ${hasWin ? '#16a34a' : LINE_COLOR}`,
      borderRadius: 6, backgroundColor: '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 8, color: '#fff', textAlign: 'center',
        padding: '2px 0', letterSpacing: '0.07em',
        textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.2,
        backgroundColor: '#a60002',
      }}>
        Table {match.table}
      </div>
      <TeamRow team={match.team1} isWinner={t1Win} score={match.team1Score} />
      <div style={{ height: 1, backgroundColor: '#e2e8f0' }} />
      <TeamRow team={match.team2} isWinner={t2Win} score={match.team2Score} />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// STANDARD bracket (8 teams and under) — left to right
// ══════════════════════════════════════════════════════════════════════════════
const StandardBracket: React.FC<{ size: number; matches: BracketMatch[]; numRounds: number }> = ({
  size, matches, numRounds,
}) => {
  const totalHeight = (size / 2) * UNIT;
  const totalWidth  = numRounds * (MATCH_W + CONN_W) - CONN_W;

  const sortedByRound = (round: number) =>
    matches.filter(m => m.round === round)
      .sort((a, b) => getVisualPos(size, round, a.table) - getVisualPos(size, round, b.table));

  const lines: React.ReactNode[] = [];
  for (let r = 1; r < numRounds; r++) {
    const rMatches = sortedByRound(r);
    const rX = (r - 1) * (MATCH_W + CONN_W) + MATCH_W;
    const nX = r * (MATCH_W + CONN_W);
    const mX = (rX + nX) / 2;
    for (let p = 0; p < rMatches.length / 2; p++) {
      const cyA = centerY(r, getVisualPos(size, r, rMatches[p * 2].table));
      const cyB = centerY(r, getVisualPos(size, r, rMatches[p * 2 + 1].table));
      const cyN = (cyA + cyB) / 2;
      lines.push(
        <g key={`s-${r}-${p}`} stroke={LINE_COLOR} strokeWidth={2} fill="none">
          <line x1={rX} y1={cyA} x2={mX} y2={cyA} />
          <line x1={rX} y1={cyB} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyA} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyN} x2={nX} y2={cyN} />
        </g>
      );
    }
  }

  return (
    <>
      {/* Headers */}
      <div style={{ display: 'flex', marginBottom: 14 }}>
        {Array.from({ length: numRounds }, (_, i) => (
          <div key={i} style={{
            width: MATCH_W, marginRight: i < numRounds - 1 ? CONN_W : 0,
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: '#a60002', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {getRoundName(i + 1, numRounds)}
          </div>
        ))}
      </div>
      {/* Canvas */}
      <div style={{ position: 'relative', height: totalHeight, width: totalWidth }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={totalWidth} height={totalHeight}>
          {lines}
        </svg>
        {Array.from({ length: numRounds }, (_, ri) => {
          const r = ri + 1;
          return sortedByRound(r).map(match => (
            <MatchCard
              key={match.id} match={match}
              x={(r - 1) * (MATCH_W + CONN_W)}
              y={topY(r, getVisualPos(size, r, match.table))}
            />
          ));
        })}
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MIRRORED bracket (16+ teams) — top half left→right, bottom half right→left
// ══════════════════════════════════════════════════════════════════════════════
const MirroredBracket: React.FC<{ size: number; matches: BracketMatch[]; numRounds: number }> = ({
  size, matches, numRounds,
}) => {
  const nSide      = numRounds - 1;           // rounds per side (excludes final)
  const halfSlots  = size / 4;               // round-1 matches per side
  const canvasH    = halfSlots * UNIT;        // vertical canvas height
  const finalX     = nSide * (MATCH_W + CONN_W);
  const canvasW    = 2 * nSide * (MATCH_W + CONN_W) + MATCH_W;

  // X positions
  const xTop = (r: number) => (r - 1) * (MATCH_W + CONN_W);
  const xBot = (r: number) => finalX + MATCH_W + CONN_W + (nSide - r) * (MATCH_W + CONN_W);

  // Half-split threshold: visPos < threshold → top half, >= → bottom half
  const thresh = (r: number) => size / Math.pow(2, r + 1);

  // Matches split by half
  const topMatches = (r: number) =>
    matches.filter(m => m.round === r && getVisualPos(size, r, m.table) < thresh(r))
      .sort((a, b) => getVisualPos(size, r, a.table) - getVisualPos(size, r, b.table));

  const botMatches = (r: number) =>
    matches.filter(m => m.round === r && getVisualPos(size, r, m.table) >= thresh(r))
      .sort((a, b) => getVisualPos(size, r, a.table) - getVisualPos(size, r, b.table));

  // Mapped visPos for bottom half (offset to start at 0)
  const botVis = (r: number, match: BracketMatch) =>
    getVisualPos(size, r, match.table) - thresh(r);

  // Build SVG lines
  const lines: React.ReactNode[] = [];

  // Top half connectors (left→right, r→r+1 within top half)
  for (let r = 1; r < nSide; r++) {
    const rM = topMatches(r);
    for (let p = 0; p < rM.length / 2; p++) {
      const cyA = centerY(r, getVisualPos(size, r, rM[p * 2].table));
      const cyB = centerY(r, getVisualPos(size, r, rM[p * 2 + 1].table));
      const cyN = (cyA + cyB) / 2;
      const rX  = xTop(r) + MATCH_W;
      const nX  = xTop(r + 1);
      const mX  = (rX + nX) / 2;
      lines.push(
        <g key={`t-${r}-${p}`} stroke={LINE_COLOR} strokeWidth={2} fill="none">
          <line x1={rX} y1={cyA} x2={mX} y2={cyA} />
          <line x1={rX} y1={cyB} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyA} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyN} x2={nX} y2={cyN} />
        </g>
      );
    }
  }

  // Left semi → Final (straight horizontal — both at canvasH/2)
  const semiCY = canvasH / 2;
  lines.push(
    <line key="semi-l" stroke={LINE_COLOR} strokeWidth={2}
      x1={xTop(nSide) + MATCH_W} y1={semiCY} x2={finalX} y2={semiCY} />
  );

  // Bottom half connectors (right→left, r→r+1 within bottom half)
  for (let r = 1; r < nSide; r++) {
    const rM = botMatches(r);
    for (let p = 0; p < rM.length / 2; p++) {
      const cyA = centerY(r, botVis(r, rM[p * 2]));
      const cyB = centerY(r, botVis(r, rM[p * 2 + 1]));
      const cyN = (cyA + cyB) / 2;
      const rX  = xBot(r);                  // left edge of round r card (connection side)
      const nX  = xBot(r + 1) + MATCH_W;   // right edge of round r+1 card
      const mX  = (rX + nX) / 2;
      lines.push(
        <g key={`b-${r}-${p}`} stroke={LINE_COLOR} strokeWidth={2} fill="none">
          <line x1={rX} y1={cyA} x2={mX} y2={cyA} />
          <line x1={rX} y1={cyB} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyA} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyN} x2={nX} y2={cyN} />
        </g>
      );
    }
  }

  // Right semi → Final (straight horizontal)
  lines.push(
    <line key="semi-r" stroke={LINE_COLOR} strokeWidth={2}
      x1={finalX + MATCH_W} y1={semiCY} x2={xBot(nSide)} y2={semiCY} />
  );

  // ── Header labels ─────────────────────────────────────────────────────────
  // Left side: Round 1 … Semi-Final
  // Center: Final
  // Right side: Semi-Final … Round 1
  const headerCols: { label: string; x: number }[] = [];
  for (let r = 1; r <= nSide; r++) {
    headerCols.push({ label: getRoundName(r, numRounds), x: xTop(r) });
  }
  headerCols.push({ label: 'Final', x: finalX });
  for (let r = nSide; r >= 1; r--) {
    headerCols.push({ label: getRoundName(r, numRounds), x: xBot(r) });
  }

  const finalMatch  = matches.find(m => m.round === numRounds);
  const finalCY     = canvasH / 2;
  const finalTopY_v = finalCY - MATCH_H / 2;

  return (
    <>
      {/* Headers */}
      <div style={{ position: 'relative', width: canvasW, marginBottom: 14 }}>
        {headerCols.map((col, i) => (
          <div key={i} style={{
            position: 'absolute', left: col.x, width: MATCH_W,
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: '#a60002', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {col.label}
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', height: canvasH, width: canvasW, marginTop: 20 }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={canvasW} height={canvasH}>
          {lines}
        </svg>

        {/* Top half (left side) */}
        {Array.from({ length: nSide }, (_, ri) => {
          const r = ri + 1;
          return topMatches(r).map(match => (
            <MatchCard key={match.id} match={match}
              x={xTop(r)}
              y={topY(r, getVisualPos(size, r, match.table))}
            />
          ));
        })}

        {/* Bottom half (right side) */}
        {Array.from({ length: nSide }, (_, ri) => {
          const r = ri + 1;
          return botMatches(r).map(match => (
            <MatchCard key={match.id} match={match}
              x={xBot(r)}
              y={topY(r, botVis(r, match))}
            />
          ));
        })}

        {/* Final — centered vertically */}
        {finalMatch && (
          <MatchCard match={finalMatch} x={finalX} y={finalTopY_v} />
        )}
      </div>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// Root export
// ══════════════════════════════════════════════════════════════════════════════
export const BracketVisual: React.FC<{ size: number; matches: BracketMatch[] }> = ({
  size, matches,
}) => {
  const numRounds  = Math.log2(size);
  const isMirrored = size >= 16;

  return (
    <div style={{ overflowX: 'auto', padding: '20px 28px 28px' }}>
      {/* Logo + title row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 16 }}>
        <img
          src={import.meta.env.BASE_URL + 'SetPlay_Logo.png'}
          alt="SetPlay"
          style={{ height: 72, opacity: 0.85, flexShrink: 0 }}
        />
        <span style={{
          fontSize: 13, fontWeight: 700, color: '#a60002',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {size}-Team Bracket
        </span>
      </div>

      {isMirrored ? (
        <MirroredBracket size={size} matches={matches} numRounds={numRounds} />
      ) : (
        <StandardBracket size={size} matches={matches} numRounds={numRounds} />
      )}
    </div>
  );
};
