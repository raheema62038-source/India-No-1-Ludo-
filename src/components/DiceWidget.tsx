import React from 'react';
import { COLOR_META } from '../engine/ludoEngine';
import { PlayerColor, PlayerConfig, Token, TurnPhase } from '../types/ludo';

export interface PlayerCornerStationProps {
  stationColor: PlayerColor;
  cornerPosition: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';
  player: PlayerConfig;
  playerNumber: number; // 1 for Blue, 2 for Green, 3 for Yellow, 4 for Red
  isCurrentTurn: boolean;
  turnPhase: TurnPhase;
  diceValue: number | null;
  playerTokens: Token[];
  movableTokenIds: Set<string>;
  consecutiveSixes: number;
  onRollDice: () => void;
  onSelectToken: (token: Token) => void;
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

/**
 * Corner Control Station positioned directly next to each player's Home Area:
 * - Player 1: BLUE Home Area (Bottom-Left)
 * - Player 2: GREEN Home Area (Top-Right)
 * - Player 3: YELLOW Home Area (Bottom-Right)
 * - Player 4: RED Home Area (Top-Left)
 *
 * The Dice Roll Button and Selectable Token Controls ONLY appear in the station
 * of the currently active player, automatically repositioning after each completed turn.
 */
export const PlayerCornerStation: React.FC<PlayerCornerStationProps> = ({
  stationColor,
  cornerPosition,
  player,
  playerNumber,
  isCurrentTurn,
  turnPhase,
  diceValue,
  playerTokens,
  movableTokenIds,
  consecutiveSixes,
  onRollDice,
  onSelectToken,
}) => {
  const meta = COLOR_META[stationColor];
  const homeCount = playerTokens.filter((t) => t.progress === 56).length;
  const isRightSide = cornerPosition === 'TOP_RIGHT' || cornerPosition === 'BOTTOM_RIGHT';

  // Inactive seat in 2-player or 3-player mode
  if (!player.active) {
    return (
      <div
        aria-label={`Player ${playerNumber} (${meta.label}) Home Area Off`}
        className="w-full min-w-0 rounded-xl bg-slate-900/35 border border-slate-800/60 px-2.5 py-2 opacity-40 flex items-center justify-between gap-1.5 min-h-[76px]"
      >
        <div
          className={`flex items-center gap-1.5 min-w-0 w-full ${
            isRightSide ? 'flex-row-reverse text-right' : ''
          }`}
        >
          <span
            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold text-white shrink-0"
            style={{ backgroundColor: meta.primaryHex }}
          >
            P{playerNumber}
          </span>
          <span className="text-[11px] font-semibold text-slate-400 truncate">
            {meta.label} · Off
          </span>
        </div>
      </div>
    );
  }

  // Active player in match, but waiting for their turn:
  // No dice button or interactive token selectors are rendered here.
  if (!isCurrentTurn) {
    return (
      <div
        aria-label={`Player ${playerNumber} (${meta.label}) Waiting`}
        className="w-full min-w-0 rounded-xl bg-slate-900/85 border border-slate-800 px-2 sm:px-2.5 py-1.5 sm:py-2 flex flex-col justify-between min-h-[76px] transition-all duration-200"
      >
        <div
          className={`flex items-center justify-between gap-1 ${
            isRightSide ? 'flex-row-reverse text-right' : ''
          }`}
        >
          <div
            className={`flex items-center gap-1.5 min-w-0 ${
              isRightSide ? 'flex-row-reverse' : ''
            }`}
          >
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold text-white shrink-0"
              style={{ backgroundColor: meta.primaryHex }}
            >
              P{playerNumber}
            </span>
            <span className="text-[11px] sm:text-xs font-bold text-slate-200 truncate">
              {player.name}
            </span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 uppercase shrink-0">
            Wait
          </span>
        </div>

        {/* Read-only token status indicators for waiting player */}
        <div
          className={`flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/80 ${
            isRightSide ? 'flex-row-reverse' : ''
          }`}
        >
          <div className="flex items-center gap-1">
            {playerTokens.map((t) => (
              <span
                key={t.id}
                className="w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center text-white/75 border border-white/15"
                style={{
                  backgroundColor: t.progress === 56 ? '#10B981' : meta.darkHex,
                }}
              >
                {t.index + 1}
              </span>
            ))}
          </div>
          <span className="text-[9px] sm:text-[10px] font-mono tabular-nums text-slate-400">
            Home {homeCount}/4
          </span>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // ACTIVE PLAYER TURN STATION (Next to Active Player's Home Area):
  // Houses the Dice Roll Button AND Current Player's Selectable Tokens
  // ===========================================================================
  const isRolling = turnPhase === 'ROLLING';
  const canRoll = turnPhase === 'ROLL_DICE' && !player.isBot;
  const displayFace = diceValue ?? 6;
  const pips = PIP_POSITIONS[displayFace] || PIP_POSITIONS[6];

  // Strictly filter to only tokens owned by this station's active player that are legal to move
  const eligibleTokens = playerTokens.filter(
    (t) =>
      t.color === stationColor &&
      turnPhase === 'SELECT_TOKEN' &&
      diceValue !== null &&
      movableTokenIds.has(t.id)
  );

  return (
    <section
      aria-label={`Active Turn Controls for Player ${playerNumber} (${meta.label})`}
      className="w-full min-w-0 rounded-xl bg-slate-900 border-2 p-1.5 sm:p-2 shadow-xl transition-all duration-200 overflow-hidden"
      style={{
        borderColor: meta.primaryHex,
        boxShadow: `0 0 18px ${meta.primaryHex}40`,
      }}
    >
      {/* Active Player Header */}
      <div
        className={`flex items-center justify-between gap-1 pb-1 mb-1 border-b border-slate-800 ${
          isRightSide ? 'flex-row-reverse' : ''
        }`}
      >
        <div
          className={`flex items-center gap-1 min-w-0 ${
            isRightSide ? 'flex-row-reverse' : ''
          }`}
        >
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold text-white shrink-0 shadow-sm"
            style={{ backgroundColor: meta.primaryHex }}
          >
            P{playerNumber}
          </span>
          <span className="text-[11px] sm:text-xs font-extrabold text-white truncate">
            {player.name}
          </span>
        </div>

        <span
          className="text-[9px] font-mono font-extrabold uppercase tracking-tight px-1.5 py-0.5 rounded text-slate-950 shrink-0"
          style={{ backgroundColor: meta.ringHex }}
        >
          {turnPhase === 'ROLL_DICE'
            ? 'Your Turn'
            : turnPhase === 'ROLLING'
            ? 'Rolling'
            : turnPhase === 'SELECT_TOKEN'
            ? eligibleTokens.length > 1
              ? `Pick 1 of ${eligibleTokens.length}`
              : 'Pick Token'
            : 'Moving'}
        </span>
      </div>

      {/* Controls Row: Dice Roll Button + Current Player's Selectable Tokens */}
      <div
        className={`flex items-center gap-1.5 ${
          isRightSide ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Dice Roll Button Next to Active Home Area */}
        <button
          type="button"
          onClick={onRollDice}
          disabled={!canRoll}
          aria-label={`Roll Dice for ${player.name} (${meta.label})`}
          className={`flex flex-col items-center justify-center rounded-xl p-1 min-w-[46px] sm:min-w-[52px] min-h-[50px] sm:min-h-[54px] border transition-transform shrink-0 ${
            canRoll
              ? 'bg-white text-slate-950 border-white shadow-md active:scale-95 cursor-pointer hover:bg-slate-100'
              : 'bg-slate-950 text-slate-200 border-slate-700 cursor-default'
          }`}
          style={{
            boxShadow: canRoll ? `0 0 0 2px ${meta.primaryHex}` : undefined,
          }}
        >
          <div className={`w-7 h-7 sm:w-8 sm:h-8 relative ${isRolling ? 'animate-dice-tumble' : ''}`}>
            <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
              <rect
                x="6"
                y="6"
                width="88"
                height="88"
                rx="20"
                fill="#FFFFFF"
                stroke={meta.primaryHex}
                strokeWidth="7"
              />
              {pips.map(([cx, cy], idx) => (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={displayFace === 1 ? 12 : 9}
                  fill={displayFace === 6 || displayFace === 1 ? meta.primaryHex : '#0F172A'}
                />
              ))}
            </svg>
          </div>
          <span className="text-[9px] font-mono font-extrabold leading-none mt-1">
            {isRolling
              ? '...'
              : canRoll
              ? 'ROLL'
              : diceValue !== null
              ? `[${diceValue}]`
              : 'WAIT'}
          </span>
        </button>

        {/* 2x2 Grid of ONLY the Current Player's 4 Tokens */}
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-1">
          {playerTokens.map((token) => {
            const isSelectable =
              token.color === stationColor &&
              turnPhase === 'SELECT_TOKEN' &&
              !player.isBot &&
              diceValue !== null &&
              movableTokenIds.has(token.id);

            let badgeLabel = 'Yard';
            if (token.progress === 56) {
              badgeLabel = 'Home';
            } else if (isSelectable && token.progress === -1) {
              badgeLabel = 'Out!';
            } else if (isSelectable && diceValue !== null) {
              badgeLabel = token.progress + diceValue === 56 ? 'Goal!' : `+${diceValue}`;
            } else if (token.progress >= 0) {
              badgeLabel = `S${token.progress}`;
            }

            return (
              <button
                key={token.id}
                type="button"
                disabled={!isSelectable}
                onClick={() => {
                  if (isSelectable && token.color === stationColor) {
                    onSelectToken(token);
                  }
                }}
                aria-label={`${player.name} Token ${token.index + 1} (${badgeLabel})`}
                className={`min-h-[24px] sm:min-h-[26px] px-1 sm:px-1.5 py-0.5 rounded-lg border flex items-center justify-between gap-0.5 text-[9px] sm:text-[10px] font-mono font-bold transition-all ${
                  isSelectable
                    ? 'bg-slate-800 text-white border-white shadow-sm cursor-pointer active:scale-95 hover:bg-slate-700 ring-1 ring-amber-300/70'
                    : 'bg-slate-950/70 border-slate-800/80 text-slate-500 cursor-default opacity-55'
                }`}
                style={{
                  borderColor: isSelectable ? meta.primaryHex : undefined,
                  backgroundColor: isSelectable ? `${meta.darkHex}` : undefined,
                }}
              >
                <span className="font-extrabold text-white">#{token.index + 1}</span>
                <span
                  className={`truncate ${
                    isSelectable ? 'text-amber-300 font-extrabold' : 'text-slate-400'
                  }`}
                >
                  {badgeLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-token selection helper or consecutive 6s indicator */}
      {turnPhase === 'SELECT_TOKEN' && eligibleTokens.length > 1 ? (
        <div className="text-[9px] font-mono font-bold text-amber-300 text-center mt-1 leading-none truncate">
          Tap eligible token ({eligibleTokens.map((t) => `#${t.index + 1}`).join(', ')})
        </div>
      ) : consecutiveSixes > 0 ? (
        <div className="text-[9px] font-mono text-amber-300 text-center mt-1 leading-none truncate">
          {consecutiveSixes}× Six Rolled · Bonus Turn
        </div>
      ) : null}
    </section>
  );
};
