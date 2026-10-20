export type PlayerColor = 'RED' | 'GREEN' | 'YELLOW' | 'BLUE';

export type GameScreenState = 'LOGIN_SCREEN' | 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY';

export type TurnPhase = 'ROLL_DICE' | 'ROLLING' | 'SELECT_TOKEN' | 'ANIMATING_MOVE';

export interface GridCoord {
  row: number; // 0 to 14
  col: number; // 0 to 14
}

export interface Token {
  id: string; // e.g., "RED-0"
  color: PlayerColor;
  index: number; // 0, 1, 2, 3
  /**
   * progress:
   * -1 = In base yard (home base)
   * 0..50 = On main outer track (0 is player's start square, 50 is player's home-stretch entrance square)
   * 51..55 = On player's colored home stretch column/row
   * 56 = Finished inside Center Home Goal triangle
   */
  progress: number;
}

export interface PlayerConfig {
  color: PlayerColor;
  name: string;
  active: boolean;
  isBot: boolean;
  finishRank?: number; // 1, 2, 3, 4 when all 4 tokens reach 56
  capturesMade: number;
  sixesRolled: number;
}

export interface MoveLogEntry {
  id: string;
  timestamp: number;
  playerColor: PlayerColor;
  playerName: string;
  diceValue: number;
  description: string;
  type: 'ROLL' | 'MOVE' | 'SPAWN' | 'CAPTURE' | 'HOME_GOAL' | 'SKIP' | 'FORFEIT_THREE_SIXES';
}

export interface ParticleBurst {
  id: string;
  row: number;
  col: number;
  color: string;
  label?: string;
}

export interface SavedGameState {
  version: number;
  savedAt: number;
  players: PlayerConfig[];
  tokens: Record<PlayerColor, Token[]>;
  currentTurnColor: PlayerColor;
  turnPhase: TurnPhase;
  diceValue: number | null;
  consecutiveSixes: number;
  winnerOrder: PlayerColor[];
  moveHistory: MoveLogEntry[];
  totalTurns: number;
}

/**
 * Architecture interfaces for future Online Multiplayer & Google AdMob integration
 */
export interface AdMobPlacementConfig {
  appIdAndroid: string;
  bannerAdUnitId: string;
  interstitialAdUnitId: string;
  rewardedAdUnitId: string;
  testMode: boolean;
}

export interface MultiplayerRoomInfo {
  roomCode: string;
  hostId: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  connectedPlayers: {
    id: string;
    name: string;
    color: PlayerColor;
    isReady: boolean;
  }[];
}
