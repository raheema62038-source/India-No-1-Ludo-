import React from 'react';
import {
  BASE_YARD_SLOTS,
  COLOR_META,
  getTokenBoardCoord,
  isCoordSafeSquare,
  PLAYER_ORDER,
} from '../engine/ludoEngine';
import { ParticleBurst, PlayerColor, PlayerConfig, Token, TurnPhase } from '../types/ludo';

interface LudoBoardProps {
  tokens: Record<PlayerColor, Token[]>;
  players: PlayerConfig[];
  currentTurnColor: PlayerColor;
  turnPhase: TurnPhase;
  movableTokenIds: Set<string>;
  selectedTokenId: string | null;
  particles: ParticleBurst[];
  onSelectToken: (token: Token) => void;
}

/**
 * Determines the cell background fill and arrow/star decorations for any (row, col)
 * on the 15x15 classic Ludo grid.
 */
function getTrackCellStyle(row: number, col: number): {
  fill: string;
  arrowDir?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  arrowColor?: string;
} {
  // Red Start Square (6, 1) & Home Stretch (7, 1..5)
  if ((row === 6 && col === 1) || (row === 7 && col >= 1 && col <= 5)) {
    return { fill: COLOR_META.RED.primaryHex };
  }
  // Green Start Square (1, 8) & Home Stretch (1..5, 7)
  if ((row === 1 && col === 8) || (col === 7 && row >= 1 && row <= 5)) {
    return { fill: COLOR_META.GREEN.primaryHex };
  }
  // Yellow Start Square (8, 13) & Home Stretch (7, 9..13)
  if ((row === 8 && col === 13) || (row === 7 && col >= 9 && col <= 13)) {
    return { fill: COLOR_META.YELLOW.primaryHex };
  }
  // Blue Start Square (13, 6) & Home Stretch (9..13, 7)
  if ((row === 13 && col === 6) || (col === 7 && row >= 9 && row <= 13)) {
    return { fill: COLOR_META.BLUE.primaryHex };
  }

  // Home Stretch Entrance Arrows
  if (row === 7 && col === 0) {
    return { fill: '#FFFDF9', arrowDir: 'RIGHT', arrowColor: COLOR_META.RED.primaryHex };
  }
  if (row === 0 && col === 7) {
    return { fill: '#FFFDF9', arrowDir: 'DOWN', arrowColor: COLOR_META.GREEN.primaryHex };
  }
  if (row === 7 && col === 14) {
    return { fill: '#FFFDF9', arrowDir: 'LEFT', arrowColor: COLOR_META.YELLOW.primaryHex };
  }
  if (row === 14 && col === 7) {
    return { fill: '#FFFDF9', arrowDir: 'UP', arrowColor: COLOR_META.BLUE.primaryHex };
  }

  // Star safe squares get a subtle warm ivory tint
  const safeInfo = isCoordSafeSquare(row, col);
  if (safeInfo.isStar) {
    return { fill: '#FEF9C3' };
  }

  return { fill: '#FFFFFF' };
}

/**
 * Offsets when multiple tokens occupy the exact same board coordinate
 */
const STACK_OFFSETS: [number, number][] = [
  [0, 0],
  [-0.18, -0.16],
  [0.18, 0.16],
  [-0.18, 0.16],
  [0.18, -0.16],
  [0, -0.22],
  [0, 0.22],
];

export const LudoBoard: React.FC<LudoBoardProps> = ({
  tokens,
  players,
  currentTurnColor,
  turnPhase,
  movableTokenIds,
  particles,
  onSelectToken,
}) => {
  const activePlayerSet = new Set(players.filter((p) => p.active).map((p) => p.color));

  // Build list of all tokens from active players and group by coordinate key for clean stacking
  const allActiveTokens: Token[] = [];
  for (const color of PLAYER_ORDER) {
    if (!activePlayerSet.has(color)) continue;
    allActiveTokens.push(...tokens[color]);
  }

  const coordGroups = new Map<string, Token[]>();
  for (const token of allActiveTokens) {
    const coord = getTokenBoardCoord(token);
    const key = `${coord.row.toFixed(2)},${coord.col.toFixed(2)}`;
    const list = coordGroups.get(key) || [];
    list.push(token);
    coordGroups.set(key, list);
  }

  // Generate the 52 + 24 track cells (everything outside the four 6x6 corner bases and 3x3 center goal)
  const trackCells: { row: number; col: number }[] = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const inTopLeftBase = r < 6 && c < 6;
      const inTopRightBase = r < 6 && c > 8;
      const inBottomLeftBase = r > 8 && c < 6;
      const inBottomRightBase = r > 8 && c > 8;
      const inCenterHome = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      if (
        !inTopLeftBase &&
        !inTopRightBase &&
        !inBottomLeftBase &&
        !inBottomRightBase &&
        !inCenterHome
      ) {
        trackCells.push({ row: r, col: c });
      }
    }
  }

  const cornerBases: {
    color: PlayerColor;
    x: number;
    y: number;
  }[] = [
    { color: 'RED', x: 0, y: 0 },
    { color: 'GREEN', x: 9, y: 0 },
    { color: 'YELLOW', x: 9, y: 9 },
    { color: 'BLUE', x: 0, y: 9 },
  ];

  return (
    <div className="relative w-full aspect-square max-w-[540px] mx-auto rounded-2xl p-1.5 sm:p-2.5 bg-slate-800 border-2 border-slate-700 shadow-2xl select-none">
      <svg
        viewBox="0 0 15 15"
        className="w-full h-full rounded-xl overflow-hidden bg-white shadow-inner"
        role="img"
        aria-label="Raheem Ludo 15 by 15 Game Board"
      >
        <defs>
          <filter id="tokenShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.08" stdDeviation="0.07" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* 1. Track Cells */}
        {trackCells.map(({ row, col }) => {
          const style = getTrackCellStyle(row, col);
          const safeInfo = isCoordSafeSquare(row, col);

          // Check if there is a movable token on this cell so tapping anywhere on the cell works smoothly
          const cellTokens = coordGroups.get(`${row.toFixed(2)},${col.toFixed(2)}`) || [];
          const movableOnCell = cellTokens.find((t) => movableTokenIds.has(t.id));

          return (
            <g
              key={`cell-${row}-${col}`}
              onClick={() => {
                if (movableOnCell) onSelectToken(movableOnCell);
              }}
              className={movableOnCell ? 'cursor-pointer' : undefined}
            >
              <rect
                x={col}
                y={row}
                width={1}
                height={1}
                fill={style.fill}
                stroke="#CBD5E1"
                strokeWidth={0.04}
              />

              {/* Highlight cell if it contains a movable token */}
              {movableOnCell && (
                <rect
                  x={col + 0.06}
                  y={row + 0.06}
                  width={0.88}
                  height={0.88}
                  rx={0.14}
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth={0.07}
                  strokeDasharray="0.18 0.1"
                />
              )}

              {/* Home Stretch Entry Arrow */}
              {style.arrowDir && (
                <g
                  transform={`translate(${col + 0.5}, ${row + 0.5}) rotate(${
                    style.arrowDir === 'RIGHT'
                      ? 0
                      : style.arrowDir === 'DOWN'
                      ? 90
                      : style.arrowDir === 'LEFT'
                      ? 180
                      : 270
                  })`}
                >
                  <path
                    d="M -0.28 0 L 0.22 0 M 0.05 -0.18 L 0.25 0 L 0.05 0.18"
                    fill="none"
                    stroke={style.arrowColor}
                    strokeWidth={0.09}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Safe Square Star Icon */}
              {safeInfo.isSafe && (
                <g transform={`translate(${col + 0.5}, ${row + 0.5})`}>
                  <polygon
                    points="0,-0.34 0.09,-0.11 0.33,-0.11 0.14,0.04 0.21,0.28 0,0.14 -0.21,0.28 -0.14,0.04 -0.33,-0.11 -0.09,-0.11"
                    fill={safeInfo.startOwner ? '#FFFFFF' : '#F59E0B'}
                    stroke={safeInfo.startOwner ? '#FFFFFF' : '#B45309'}
                    strokeWidth={0.03}
                    opacity={safeInfo.startOwner ? 0.92 : 0.95}
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* 2. Four 6x6 Corner Bases (Red, Green, Yellow, Blue) */}
        {cornerBases.map(({ color, x, y }) => {
          const meta = COLOR_META[color];
          const isPlayerActive = activePlayerSet.has(color);
          const isTurn = currentTurnColor === color;
          const playerConfig = players.find((p) => p.color === color);
          const baseSlots = BASE_YARD_SLOTS[color];

          return (
            <g key={`base-${color}`} opacity={isPlayerActive ? 1 : 0.42}>
              {/* Outer Colored 6x6 Box */}
              <rect
                x={x}
                y={y}
                width={6}
                height={6}
                fill={meta.primaryHex}
                stroke="#1E293B"
                strokeWidth={0.06}
              />

              {/* Active Turn Pulsing Inner Border */}
              {isTurn && isPlayerActive && (
                <rect
                  x={x + 0.18}
                  y={y + 0.18}
                  width={5.64}
                  height={5.64}
                  rx={0.4}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={0.14}
                />
              )}

              {/* White Inner Yard Card */}
              <rect
                x={x + 0.85}
                y={y + 0.85}
                width={4.3}
                height={4.3}
                rx={0.55}
                fill="#FFFFFF"
                stroke={meta.darkHex}
                strokeWidth={0.08}
              />

              {/* Player Seat & Name Label inside Base Header */}
              <text
                x={x + 3}
                y={y + 0.58}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="0.36"
                fontWeight="800"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {playerConfig?.active
                  ? `P${PLAYER_ORDER.indexOf(color) + 1} · ${playerConfig.name.slice(0, 10)}`
                  : `P${PLAYER_ORDER.indexOf(color) + 1} · ${meta.label} (Off)`}
              </text>

              {/* 4 Circular Token Yard Slots */}
              {baseSlots.map((slot, idx) => (
                <circle
                  key={`slot-${color}-${idx}`}
                  cx={slot.col + 0.5}
                  cy={slot.row + 0.5}
                  r={0.52}
                  fill={meta.lightHex}
                  stroke={meta.primaryHex}
                  strokeWidth={0.07}
                />
              ))}
            </g>
          );
        })}

        {/* 3. Center 3x3 Home Goal Triangles (rows 6..8, cols 6..8) */}
        <g>
          {/* Red Left Triangle */}
          <polygon
            points="6,6 7.5,7.5 6,9"
            fill={COLOR_META.RED.primaryHex}
            stroke="#1E293B"
            strokeWidth={0.05}
          />
          {/* Green Top Triangle */}
          <polygon
            points="6,6 9,6 7.5,7.5"
            fill={COLOR_META.GREEN.primaryHex}
            stroke="#1E293B"
            strokeWidth={0.05}
          />
          {/* Yellow Right Triangle */}
          <polygon
            points="9,6 9,9 7.5,7.5"
            fill={COLOR_META.YELLOW.primaryHex}
            stroke="#1E293B"
            strokeWidth={0.05}
          />
          {/* Blue Bottom Triangle */}
          <polygon
            points="6,9 9,9 7.5,7.5"
            fill={COLOR_META.BLUE.primaryHex}
            stroke="#1E293B"
            strokeWidth={0.05}
          />
          {/* Center Trophy Badge */}
          <circle
            cx={7.5}
            cy={7.5}
            r={0.46}
            fill="#0F172A"
            stroke="#F8FAFC"
            strokeWidth={0.06}
          />
          <polygon
            points="7.5,7.16 7.6,7.38 7.84,7.38 7.65,7.52 7.72,7.75 7.5,7.61 7.28,7.75 7.35,7.52 7.16,7.38 7.4,7.38"
            fill="#FACC15"
          />
        </g>

        {/* 4. Render All Active Tokens */}
        {Array.from(coordGroups.entries()).map(([coordKey, groupTokens]) => {
          // Sort so movable tokens render on top of stationary ones
          const sortedGroup = [...groupTokens].sort((a, b) => {
            const aMovable = movableTokenIds.has(a.id) ? 1 : 0;
            const bMovable = movableTokenIds.has(b.id) ? 1 : 0;
            return aMovable - bMovable;
          });

          return sortedGroup.map((token, stackIdx) => {
            const baseCoord = getTokenBoardCoord(token);
            const isMovable =
              turnPhase === 'SELECT_TOKEN' && movableTokenIds.has(token.id);
            const meta = COLOR_META[token.color];

            const [offsetX, offsetY] =
              sortedGroup.length === 1
                ? [0, 0]
                : STACK_OFFSETS[(stackIdx + 1) % STACK_OFFSETS.length];

            const cx = baseCoord.col + 0.5 + offsetX;
            const cy = baseCoord.row + 0.5 + offsetY;
            const radius = sortedGroup.length > 1 && token.progress !== -1 ? 0.34 : 0.4;

            return (
              <g
                key={token.id}
                transform={`translate(${cx}, ${cy})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMovable) {
                    onSelectToken(token);
                  }
                }}
                className={isMovable ? 'cursor-pointer' : ' pointer-events-none'}
              >
                {/* Invisible Expanded Touch Hitbox (1.1x1.1 grid units) for Mobile Accuracy */}
                {isMovable && (
                  <circle
                    cx={0}
                    cy={0}
                    r={0.62}
                    fill="transparent"
                  />
                )}

                {/* Animated Target Ring when Movable */}
                {isMovable && (
                  <circle
                    cx={0}
                    cy={0}
                    r={radius + 0.14}
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth={0.07}
                  >
                    <animate
                      attributeName="r"
                      values={`${radius + 0.06};${radius + 0.2};${radius + 0.06}`}
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0.35;1"
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Outer Pawn Base */}
                <circle
                  cx={0}
                  cy={0}
                  r={radius}
                  fill={meta.primaryHex}
                  stroke="#FFFFFF"
                  strokeWidth={0.08}
                  filter="url(#tokenShadow)"
                />

                {/* Inner Pawn Crown Ring */}
                <circle
                  cx={0}
                  cy={-0.02}
                  r={radius * 0.58}
                  fill={meta.darkHex}
                  stroke={meta.ringHex}
                  strokeWidth={0.04}
                />

                {/* Token Number (1..4) */}
                <text
                  x={0}
                  y={0.09}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize={radius * 0.72}
                  fontWeight="800"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {token.index + 1}
                </text>
              </g>
            );
          });
        })}

        {/* 5. Particle Bursts on Capture or Home Entry */}
        {particles.map((burst) => (
          <g
            key={burst.id}
            transform={`translate(${burst.col + 0.5}, ${burst.row + 0.5})`}
            className="pointer-events-none"
          >
            <circle cx={0} cy={0} r={0.5} fill="none" stroke={burst.color} strokeWidth={0.1}>
              <animate attributeName="r" from="0.2" to="1.15" dur="0.55s" fill="freeze" />
              <animate attributeName="opacity" from="1" to="0" dur="0.55s" fill="freeze" />
            </circle>
            {burst.label && (
              <text
                x={0}
                y={-0.45}
                textAnchor="middle"
                fill="#0F172A"
                stroke="#FFFFFF"
                strokeWidth={0.08}
                paintOrder="stroke"
                fontSize="0.42"
                fontWeight="800"
              >
                {burst.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
