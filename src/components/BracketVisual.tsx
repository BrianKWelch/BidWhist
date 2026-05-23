import React from 'react';
import type { BracketMatch, BracketTeam } from '@/contexts/AppContext';
import { getVisualPos } from '@/lib/bracketUtils';
import setplayLogo from '@/assets/SetPlay_Logo crop.png';

// ── Layout constants ──────────────────────────────────────────────────────────
const MATCH_H = 78;   // height of each match card (px)
const MATCH_W = 215;  // width of each match card (px)
const CONN_W  = 50;   // horizontal connector width (px)
const UNIT    = 100;  // vertical space per round-1 slot — must be >= MATCH_H

const LINE_COLOR = '#475569'; // shared between connectors and card borders

// ── Geometry helpers ──────────────────────────────────────────────────────────
const slotH   = (round: number) => Math.pow(2, round - 1) * UNIT;
const centerY = (round: number, visPos: number) =>
  visPos * slotH(round) + slotH(round) / 2;
const topY    = (round: number, visPos: number) =>
  centerY(round, visPos) - MATCH_H / 2;
const leftX   = (round: number) => (round - 1) * (MATCH_W + CONN_W);

const getRoundName = (round: number, numRounds: number): string => {
  if (round === numRounds)     return 'Final';
  if (round === numRounds - 1) return 'Semi-Final';
  if (round === numRounds - 2) return 'Quarter-Final';
  return `Round ${round}`;
};

// ── Team row ─────────────────────────────────────────────────────────────────
const TeamRow: React.FC<{
  team?: BracketTeam;
  isWinner: boolean;
  score?: number;
}> = ({ team, isWinner, score }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: isWinner ? '#dcfce7' : 'transparent',
  }}>
    {team ? (
      <>
        <span style={{ fontSize: 9, color: '#9ca3af', minWidth: 16, fontWeight: 600 }}>
          #{team.seed}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#111827', minWidth: 22 }}>
          {team.teamNumber}
        </span>
        <span style={{
          fontSize: 11, color: '#374151', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {team.teamName}
        </span>
        {typeof score === 'number' && (
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isWinner ? '#16a34a' : '#9ca3af',
            minWidth: 20, textAlign: 'right',
          }}>
            {score}
          </span>
        )}
        {isWinner && <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 1 }}>✓</span>}
      </>
    ) : (
      <span style={{ fontSize: 10, color: '#d1d5db', fontStyle: 'italic' }}>TBD</span>
    )}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const BracketVisual: React.FC<{ size: number; matches: BracketMatch[] }> = ({
  size,
  matches,
}) => {
  const numRounds   = Math.log2(size);
  const totalHeight = (size / 2) * UNIT;
  const totalWidth  = numRounds * (MATCH_W + CONN_W) - CONN_W;

  // Sort matches in a round by their correct visual position
  const sortedByRound = (round: number) =>
    matches
      .filter(m => m.round === round)
      .sort((a, b) => getVisualPos(size, round, a.table) - getVisualPos(size, round, b.table));

  // Build SVG connector lines
  const lines: React.ReactNode[] = [];
  for (let r = 1; r < numRounds; r++) {
    const rMatches    = sortedByRound(r);
    const numPairs    = rMatches.length / 2;
    const rX          = leftX(r) + MATCH_W;   // right edge of round r cards
    const mX          = rX + CONN_W / 2;      // x of vertical connector
    const nX          = leftX(r + 1);         // left edge of round r+1 cards

    for (let p = 0; p < numPairs; p++) {
      const visA = getVisualPos(size, r, rMatches[p * 2].table);
      const visB = getVisualPos(size, r, rMatches[p * 2 + 1].table);
      const cyA  = centerY(r, visA);
      const cyB  = centerY(r, visB);
      const cyN  = (cyA + cyB) / 2;

      lines.push(
        <g key={`c-${r}-${p}`} stroke={LINE_COLOR} strokeWidth={2} fill="none">
          <line x1={rX} y1={cyA} x2={mX} y2={cyA} />
          <line x1={rX} y1={cyB} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyA} x2={mX} y2={cyB} />
          <line x1={mX} y1={cyN} x2={nX} y2={cyN} />
        </g>
      );
    }
  }

  return (
    <div style={{ overflowX: 'auto', padding: '20px 28px 28px' }}>

      {/* Logo + round header row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>

        {/* Round header labels — same width as bracket */}
        <div style={{ display: 'flex', flex: 1 }}>
          {Array.from({ length: numRounds }, (_, i) => (
            <div key={i} style={{
              width: MATCH_W,
              marginRight: i < numRounds - 1 ? CONN_W : 0,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#a60002',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {getRoundName(i + 1, numRounds)}
            </div>
          ))}
        </div>

        {/* SetPlay logo — right of headers */}
        <img
          src={setplayLogo}
          alt="SetPlay"
          style={{ height: 36, marginLeft: 24, opacity: 0.85, flexShrink: 0 }}
        />
      </div>

      {/* Bracket canvas */}
      <div style={{ position: 'relative', height: totalHeight, width: totalWidth }}>

        {/* SVG connector lines */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={totalWidth}
          height={totalHeight}
        >
          {lines}
        </svg>

        {/* Match cards */}
        {Array.from({ length: numRounds }, (_, ri) => {
          const round        = ri + 1;
          const roundMatches = sortedByRound(round);

          return roundMatches.map((match) => {
            const visPos  = getVisualPos(size, round, match.table);
            const t1Win   = !!match.winner && match.winner.teamId === match.team1?.teamId;
            const t2Win   = !!match.winner && match.winner.teamId === match.team2?.teamId;
            const hasWin  = t1Win || t2Win;

            return (
              <div key={match.id} style={{
                position: 'absolute',
                top:   topY(round, visPos),
                left:  leftX(round),
                width: MATCH_W,
                height: MATCH_H,
                border: `1.5px solid ${hasWin ? '#16a34a' : LINE_COLOR}`,
                borderRadius: 6,
                backgroundColor: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* Table label — red bar */}
                <div style={{
                  fontSize: 9,
                  color: '#fff',
                  textAlign: 'center',
                  padding: '3px 0',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  backgroundColor: '#a60002',
                }}>
                  Table {match.table}
                </div>

                <TeamRow team={match.team1} isWinner={t1Win} score={match.team1Score} />
                <div style={{ height: 1, backgroundColor: '#e2e8f0' }} />
                <TeamRow team={match.team2} isWinner={t2Win} score={match.team2Score} />
              </div>
            );
          });
        })}
      </div>
    </div>
  );
};
