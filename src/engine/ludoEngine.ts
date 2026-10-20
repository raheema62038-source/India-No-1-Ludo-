import { GridCoord, PlayerColor, PlayerConfig, SavedGameState, Token, TurnPhase } from '../types/ludo';

/**
 * Standard turn order matching the 4 Home Areas:
 * Player 1: BLUE (Bottom-Left Home Area)
 * Player 2: GREEN (Top-Right Home Area)
 * Player 3: YELLOW (Bottom-Right Home Area)
 * Player 4: RED (Top-Left Home Area)
 */
export const PLAYER_ORDER: PlayerColor[] = ['BLUE', 'GREEN', 'YELLOW', 'RED'];

export const COLOR_META: Record<
  PlayerColor,
  {
    label: string;
    primaryHex: string;
    darkHex: string;
    lightHex: string;
    ringHex: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    startTrackIndex: number;
    startCoord: GridCoord;
  }
> = {
  RED: {
    label: 'Red',
    primaryHex: '#EF4444',
    darkHex: '#B91C1C',
    lightHex: '#FEE2E2',
    ringHex: '#FCA5A5',
    bgClass: 'bg-red-500',
    textClass: 'text-red-400',
    borderClass: 'border-red-500',
    startTrackIndex: 0,
    startCoord: { row: 6, col: 1 },
  },
  GREEN: {
    label: 'Green',
    primaryHex: '#10B981',
    darkHex: '#047857',
    lightHex: '#D1FAE5',
    ringHex: '#6EE7B7',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500',
    startTrackIndex: 13,
    startCoord: { row: 1, col: 8 },
  },
  YELLOW: {
    label: 'Yellow',
    primaryHex: '#F59E0B',
    darkHex: '#B45309',
    lightHex: '#FEF3C7',
    ringHex: '#FCD34D',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500',
    startTrackIndex: 26,
    startCoord: { row: 8, col: 13 },
  },
  BLUE: {
    label: 'Blue',
    primaryHex: '#3B82F6',
    darkHex: '#1D4ED8',
    lightHex: '#DBEAFE',
    ringHex: '#93C5FD',
    bgClass: 'bg-blue-500',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500',
    startTrackIndex: 39,
    startCoord: { row: 13, col: 6 },
  },
};

/**
 * 52-square clockwise perimeter track on a 15x15 Ludo board (rows 0..14, cols 0..14).
 * Index 0 is RED's start square at (row: 6, col: 1).
 * Index 13 is GREEN's start square at (row: 1, col: 8).
 * Index 26 is YELLOW's start square at (row: 8, col: 13).
 * Index 39 is BLUE's start square at (row: 13, col: 6).
 */
export const MAIN_TRACK_COORDS: GridCoord[] = [
  // Red arm top row moving right (0..4)
  { row: 6, col: 1 }, // 0 - RED START (SAFE)
  { row: 6, col: 2 }, // 1
  { row: 6, col: 3 }, // 2
  { row: 6, col: 4 }, // 3
  { row: 6, col: 5 }, // 4
  // Green arm left col moving up (5..10)
  { row: 5, col: 6 }, // 5
  { row: 4, col: 6 }, // 6
  { row: 3, col: 6 }, // 7
  { row: 2, col: 6 }, // 8 - STAR SAFE
  { row: 1, col: 6 }, // 9
  { row: 0, col: 6 }, // 10
  // Green arm top turn (11..12)
  { row: 0, col: 7 }, // 11 - GREEN HOME ENTRANCE TURN
  { row: 0, col: 8 }, // 12
  // Green arm right col moving down (13..17)
  { row: 1, col: 8 }, // 13 - GREEN START (SAFE)
  { row: 2, col: 8 }, // 14
  { row: 3, col: 8 }, // 15
  { row: 4, col: 8 }, // 16
  { row: 5, col: 8 }, // 17
  // Yellow arm top row moving right (18..23)
  { row: 6, col: 9 },  // 18
  { row: 6, col: 10 }, // 19
  { row: 6, col: 11 }, // 20
  { row: 6, col: 12 }, // 21 - STAR SAFE
  { row: 6, col: 13 }, // 22
  { row: 6, col: 14 }, // 23
  // Yellow arm right turn (24..25)
  { row: 7, col: 14 }, // 24 - YELLOW HOME ENTRANCE TURN
  { row: 8, col: 14 }, // 25
  // Yellow arm bottom row moving left (26..30)
  { row: 8, col: 13 }, // 26 - YELLOW START (SAFE)
  { row: 8, col: 12 }, // 27
  { row: 8, col: 11 }, // 28
  { row: 8, col: 10 }, // 29
  { row: 8, col: 9 },  // 30
  // Blue arm right col moving down (31..36)
  { row: 9, col: 8 },  // 31
  { row: 10, col: 8 }, // 32
  { row: 11, col: 8 }, // 33
  { row: 12, col: 8 }, // 34 - STAR SAFE
  { row: 13, col: 8 }, // 35
  { row: 14, col: 8 }, // 36
  // Blue arm bottom turn (37..38)
  { row: 14, col: 7 }, // 37 - BLUE HOME ENTRANCE TURN
  { row: 14, col: 6 }, // 38
  // Blue arm left col moving up (39..43)
  { row: 13, col: 6 }, // 39 - BLUE START (SAFE)
  { row: 12, col: 6 }, // 40
  { row: 11, col: 6 }, // 41
  { row: 10, col: 6 }, // 42
  { row: 9, col: 6 },  // 43
  // Red arm bottom row moving left (44..49)
  { row: 8, col: 5 },  // 44
  { row: 8, col: 4 },  // 45
  { row: 8, col: 3 },  // 46
  { row: 8, col: 2 },  // 47 - STAR SAFE
  { row: 8, col: 1 },  // 48
  { row: 8, col: 0 },  // 49
  // Red arm left turn (50..51)
  { row: 7, col: 0 },  // 50 - RED HOME ENTRANCE TURN
  { row: 6, col: 0 },  // 51
];

/**
 * 8 Safe squares on the 52-cell main track (4 Colored Start Squares + 4 Star Squares)
 */
export const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

export const SAFE_COORDS: GridCoord[] = Array.from(SAFE_TRACK_INDICES).map(
  (idx) => MAIN_TRACK_COORDS[idx]
);

/**
 * Home stretch paths (progress 51..55) and Home Goal coordinate (progress 56)
 */
export const HOME_STRETCH_COORDS: Record<PlayerColor, GridCoord[]> = {
  RED: [
    { row: 7, col: 1 }, // progress 51
    { row: 7, col: 2 }, // progress 52
    { row: 7, col: 3 }, // progress 53
    { row: 7, col: 4 }, // progress 54
    { row: 7, col: 5 }, // progress 55
    { row: 7, col: 6 }, // progress 56 (Center Home Triangle - Left)
  ],
  GREEN: [
    { row: 1, col: 7 }, // progress 51
    { row: 2, col: 7 }, // progress 52
    { row: 3, col: 7 }, // progress 53
    { row: 4, col: 7 }, // progress 54
    { row: 5, col: 7 }, // progress 55
    { row: 6, col: 7 }, // progress 56 (Center Home Triangle - Top)
  ],
  YELLOW: [
    { row: 7, col: 13 }, // progress 51
    { row: 7, col: 12 }, // progress 52
    { row: 7, col: 11 }, // progress 53
    { row: 7, col: 10 }, // progress 54
    { row: 7, col: 9 },  // progress 55
    { row: 7, col: 8 },  // progress 56 (Center Home Triangle - Right)
  ],
  BLUE: [
    { row: 13, col: 7 }, // progress 51
    { row: 12, col: 7 }, // progress 52
    { row: 11, col: 7 }, // progress 53
    { row: 10, col: 7 }, // progress 54
    { row: 9, col: 7 },  // progress 55
    { row: 8, col: 7 },  // progress 56 (Center Home Triangle - Bottom)
  ],
};

/**
 * Base yard token slot positions (when token.progress === -1)
 */
export const BASE_YARD_SLOTS: Record<PlayerColor, GridCoord[]> = {
  RED: [
    { row: 1.8, col: 1.8 },
    { row: 1.8, col: 3.2 },
    { row: 3.2, col: 1.8 },
    { row: 3.2, col: 3.2 },
  ],
  GREEN: [
    { row: 1.8, col: 10.8 },
    { row: 1.8, col: 12.2 },
    { row: 3.2, col: 10.8 },
    { row: 3.2, col: 12.2 },
  ],
  YELLOW: [
    { row: 10.8, col: 10.8 },
    { row: 10.8, col: 12.2 },
    { row: 12.2, col: 10.8 },
    { row: 12.2, col: 12.2 },
  ],
  BLUE: [
    { row: 10.8, col: 1.8 },
    { row: 10.8, col: 3.2 },
    { row: 12.2, col: 1.8 },
    { row: 12.2, col: 3.2 },
  ],
};

/**
 * Converts a token's (color, index, progress) to its exact 15x15 board coordinate.
 */
export function getTokenBoardCoord(token: Token): GridCoord {
  if (token.progress === -1) {
    return BASE_YARD_SLOTS[token.color][token.index];
  }
  if (token.progress >= 0 && token.progress <= 50) {
    const trackIdx = (COLOR_META[token.color].startTrackIndex + token.progress) % 52;
    return MAIN_TRACK_COORDS[trackIdx];
  }
  const stretchIdx = Math.min(token.progress - 51, 5);
  return HOME_STRETCH_COORDS[token.color][stretchIdx];
}

/**
 * Returns the global 0..51 main track index if the token is on the outer perimeter track,
 * or null if the token is in its base yard (-1) or home stretch (51..56).
 */
export function getGlobalTrackIndex(color: PlayerColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (COLOR_META[color].startTrackIndex + progress) % 52;
}

export function isCoordSafeSquare(row: number, col: number): { isSafe: boolean; isStar: boolean; startOwner?: PlayerColor } {
  for (const color of PLAYER_ORDER) {
    const start = COLOR_META[color].startCoord;
    if (start.row === row && start.col === col) {
      return { isSafe: true, isStar: false, startOwner: color };
    }
  }
  const starSquares: GridCoord[] = [
    { row: 2, col: 6 },
    { row: 6, col: 12 },
    { row: 12, col: 8 },
    { row: 8, col: 2 },
  ];
  if (starSquares.some((s) => s.row === row && s.col === col)) {
    return { isSafe: true, isStar: true };
  }
  return { isSafe: false, isStar: false };
}

/**
 * Determines whether a specific token can legally move given `diceValue` (1..6).
 */
export function canTokenMove(token: Token, diceValue: number): boolean {
  if (token.progress === 56) {
    return false; // Already finished in Home Goal
  }
  if (token.progress === -1) {
    return diceValue === 6; // Needs a 6 to exit Base Yard onto Start Square
  }
  return token.progress + diceValue <= 56; // Must not overshoot 56
}

/**
 * Strict validation that ensures a player can ONLY move their own eligible token
 * during the SELECT_TOKEN phase.
 */
export function canPlayerMoveToken(
  activeTurnColor: PlayerColor,
  token: Token,
  diceValue: number | null,
  turnPhase: TurnPhase
): boolean {
  if (turnPhase !== 'SELECT_TOKEN' || diceValue === null) return false;
  if (token.color !== activeTurnColor) return false;
  return canTokenMove(token, diceValue);
}

/**
 * Returns all movable tokens strictly belonging to the active player given a dice roll.
 */
export function getMovableTokens(
  tokens: Token[],
  diceValue: number,
  expectedColor?: PlayerColor
): Token[] {
  return tokens.filter(
    (t) => (!expectedColor || t.color === expectedColor) && canTokenMove(t, diceValue)
  );
}

/**
 * Evaluates the outcome of moving `token` by `diceValue` steps, including whether it captures
 * any opponent tokens on the destination square.
 */
export function evaluateMoveOutcome(
  token: Token,
  diceValue: number,
  allTokens: Record<PlayerColor, Token[]>,
  activeColors: PlayerColor[]
): {
  newProgress: number;
  capturedTokens: Token[];
  reachedHomeGoal: boolean;
  landedOnSafeSquare: boolean;
  grantsBonusTurn: boolean;
} {
  const newProgress = token.progress === -1 ? 0 : token.progress + diceValue;
  const reachedHomeGoal = newProgress === 56;
  const destTrackIdx = getGlobalTrackIndex(token.color, newProgress);
  const landedOnSafeSquare = destTrackIdx !== null && SAFE_TRACK_INDICES.has(destTrackIdx);

  const capturedTokens: Token[] = [];

  if (destTrackIdx !== null && !landedOnSafeSquare) {
    // Check if opponent tokens occupy `destTrackIdx`
    for (const otherColor of activeColors) {
      if (otherColor === token.color) continue;
      for (const oppToken of allTokens[otherColor]) {
        const oppTrackIdx = getGlobalTrackIndex(oppToken.color, oppToken.progress);
        if (oppTrackIdx === destTrackIdx) {
          capturedTokens.push(oppToken);
        }
      }
    }
  }

  // Bonus roll is granted on:
  // 1) Rolling a 6
  // 2) Capturing an opponent token
  // 3) Reaching the center Home Goal (56)
  const grantsBonusTurn = diceValue === 6 || capturedTokens.length > 0 || reachedHomeGoal;

  return {
    newProgress,
    capturedTokens,
    reachedHomeGoal,
    landedOnSafeSquare,
    grantsBonusTurn,
  };
}

/**
 * Smart AI / Auto-move heuristic to choose the best legal token when a Bot plays
 * or when all movable tokens are in identical positions.
 */
export function pickBestTokenMove(
  movableTokens: Token[],
  diceValue: number,
  allTokens: Record<PlayerColor, Token[]>,
  activeColors: PlayerColor[]
): Token {
  if (movableTokens.length === 1) return movableTokens[0];

  let bestToken = movableTokens[0];
  let bestScore = -Infinity;

  for (const token of movableTokens) {
    const outcome = evaluateMoveOutcome(token, diceValue, allTokens, activeColors);
    let score = 0;

    // Highest priority: Capturing opponent token
    if (outcome.capturedTokens.length > 0) {
      score += 120 * outcome.capturedTokens.length;
    }
    // High priority: Bringing a new token out of the base yard on a 6
    if (token.progress === -1 && diceValue === 6) {
      score += 85;
    }
    // High priority: Reaching the Home Goal triangle
    if (outcome.reachedHomeGoal) {
      score += 100;
    }
    // Medium priority: Landing on a safe star/start square
    if (outcome.landedOnSafeSquare && token.progress !== -1) {
      score += 45;
    }
    // Entering home stretch (safe from capture)
    if (token.progress <= 50 && outcome.newProgress >= 51) {
      score += 60;
    }
    // Leaving a safe square when risky is slightly penalized
    const currentTrackIdx = getGlobalTrackIndex(token.color, token.progress);
    if (currentTrackIdx !== null && SAFE_TRACK_INDICES.has(currentTrackIdx)) {
      score -= 15;
    }
    // Prefer advancing the furthest token slightly
    score += token.progress * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestToken = token;
    }
  }

  return bestToken;
}

/**
 * Creates a fresh set of 4 tokens per color.
 */
export function createInitialTokens(): Record<PlayerColor, Token[]> {
  const result = {} as Record<PlayerColor, Token[]>;
  for (const color of PLAYER_ORDER) {
    result[color] = [0, 1, 2, 3].map((index) => ({
      id: `${color}-${index}`,
      color,
      index,
      progress: -1,
    }));
  }
  return result;
}

/**
 * Default player configurations for 2, 3, or 4 players:
 * Player 1 = BLUE (Bottom-Left Home Area)
 * Player 2 = GREEN (Top-Right Home Area)
 * Player 3 = YELLOW (Bottom-Right Home Area)
 * Player 4 = RED (Top-Left Home Area)
 */
export function createDefaultPlayers(playerCount: 2 | 3 | 4): PlayerConfig[] {
  const activeSet =
    playerCount === 2
      ? new Set<PlayerColor>(['BLUE', 'GREEN'])
      : playerCount === 3
      ? new Set<PlayerColor>(['BLUE', 'GREEN', 'YELLOW'])
      : new Set<PlayerColor>(['BLUE', 'GREEN', 'YELLOW', 'RED']);

  let activeIndex = 1;
  return PLAYER_ORDER.map((color) => {
    const isActive = activeSet.has(color);
    const name = isActive ? `Player ${activeIndex++}` : `${COLOR_META[color].label}`;
    return {
      color,
      name,
      active: isActive,
      isBot: false,
      capturesMade: 0,
      sixesRolled: 0,
    };
  });
}

export const LOCAL_STORAGE_SAVE_KEY = 'raheem_ludo_saved_game_v1';

export function saveGameToStorage(state: SavedGameState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadGameFromStorage(): SavedGameState | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGameState;
    if (parsed && parsed.version === 1 && parsed.players && parsed.tokens) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSavedGameFromStorage(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
  } catch {
    // Ignore
  }
}
