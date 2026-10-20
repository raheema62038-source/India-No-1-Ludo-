import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Home,
  RotateCcw,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AndroidExportModal } from './components/AndroidExportModal';
import { PlayerCornerStation } from './components/DiceWidget';
import { BottomNavTab, LobbyViews, LocalPlayerProfile } from './components/LobbyViews';
import { LoginScreen } from './components/LoginScreen';
import { LudoBoard } from './components/LudoBoard';
import {
  canPlayerMoveToken,
  clearSavedGameFromStorage,
  COLOR_META,
  createDefaultPlayers,
  createInitialTokens,
  evaluateMoveOutcome,
  getMovableTokens,
  getTokenBoardCoord,
  loadGameFromStorage,
  pickBestTokenMove,
  PLAYER_ORDER,
  saveGameToStorage,
} from './engine/ludoEngine';
import {
  auth,
  FirebaseUser,
  LiveRoomDoc,
  OnlinePlayerDoc,
  onAuthStateChanged,
  subscribeToOnlinePresenceAndRooms,
  syncOrRestoreUserCloudSave,
  upsertPublicProfile,
} from './firebase';
import { soundFX } from './services/audio';
import { adMobService, multiplayerService } from './services/futureIntegrations';
import {
  GameScreenState,
  MoveLogEntry,
  ParticleBurst,
  PlayerColor,
  PlayerConfig,
  SavedGameState,
  Token,
  TurnPhase,
} from './types/ludo';

const PROFILE_STORAGE_KEY = 'raheem_ludo_player_profile_v1';

function loadPlayerProfile(): LocalPlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalPlayerProfile;
      if (parsed && parsed.playerId) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return {
    playerId: `RL-${Math.floor(1000 + Math.random() * 9000)}`,
    displayName: 'Player 1',
    avatarColor: 'BLUE',
    coins: 0, // Genuine earned balance
    gems: 0,
    lastDailyClaimDate: null,
    dailyStreak: 0,
    lastSpinTimestamp: null,
    equippedDiceStyle: 'CLASSIC',
    equippedTokenStyle: 'CROWN',
    unlockedItems: [],
    friends: [],
    fbConnected: false,
  };
}

export default function App() {
  // Screen State Machine (Starts on Login Screen)
  const [screenState, setScreenState] = useState<GameScreenState>('LOGIN_SCREEN');
  const [activeLobbyTab, setActiveLobbyTab] = useState<BottomNavTab>('HOME');

  // Persistent Player Profile (Avatar, Genuine Earned Coins/Gems, Friends, Inventory)
  const [profile, setProfile] = useState<LocalPlayerProfile>(() => loadPlayerProfile());

  // Firebase Auth & Live Firestore Presence/Rooms State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayerDoc[]>([]);
  const [liveRooms, setLiveRooms] = useState<LiveRoomDoc[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore quota errors
    }
  }, [profile]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setOnlinePlayers([]);
        setLiveRooms([]);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    if (screenState !== 'LOGIN_SCREEN') {
      upsertPublicProfile(
        firebaseUser,
        profile.playerId,
        profile.avatarColor,
        screenState === 'PLAYING' ? 'IN_MATCH' : 'ONLINE',
        profile.displayName
      ).catch(() => {});
    }

    const unsubFirestore = subscribeToOnlinePresenceAndRooms(
      (playersList) => setOnlinePlayers(playersList),
      (roomsList) => setLiveRooms(roomsList)
    );
    return () => unsubFirestore();
  }, [firebaseUser, profile.playerId, profile.avatarColor, profile.displayName, screenState]);

  // Keep authenticated user's virtual coin/gem balance & cosmetics synced in Firestore (/user_saves/{uid})
  useEffect(() => {
    if (!firebaseUser || screenState === 'LOGIN_SCREEN') return;
    const syncTimer = window.setTimeout(() => {
      syncOrRestoreUserCloudSave(
        firebaseUser,
        {
          playerCode: profile.playerId,
          displayName: profile.displayName,
          avatarColor: profile.avatarColor,
          coins: profile.coins,
          gems: profile.gems,
          dailyStreak: profile.dailyStreak,
          lastDailyClaimDate: profile.lastDailyClaimDate,
          equippedDiceStyle: profile.equippedDiceStyle,
          equippedTokenStyle: profile.equippedTokenStyle,
          unlockedItems: profile.unlockedItems,
          savedMatchTurn: 0,
        },
        'LINK_SAVE'
      ).catch(() => {});
    }, 600);
    return () => window.clearTimeout(syncTimer);
  }, [
    firebaseUser,
    screenState,
    profile.playerId,
    profile.displayName,
    profile.avatarColor,
    profile.coins,
    profile.gems,
    profile.dailyStreak,
    profile.lastDailyClaimDate,
    profile.equippedDiceStyle,
    profile.equippedTokenStyle,
    profile.unlockedItems,
  ]);

  // Setup Configuration for Pass N Play (2 to 4 players)
  // Default order: Player 1 = BLUE, Player 2 = GREEN, Player 3 = YELLOW, Player 4 = RED
  const [setupPlayerCount, setSetupPlayerCount] = useState<2 | 3 | 4>(4);
  const [setupPlayers, setSetupPlayers] = useState<PlayerConfig[]>(() =>
    createDefaultPlayers(4)
  );

  // Active Match State (Player 1 starts on BLUE Home Area)
  const [players, setPlayers] = useState<PlayerConfig[]>(() => createDefaultPlayers(4));
  const [tokens, setTokens] = useState<Record<PlayerColor, Token[]>>(() =>
    createInitialTokens()
  );
  const [currentTurnColor, setCurrentTurnColor] = useState<PlayerColor>('BLUE');
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('ROLL_DICE');
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [consecutiveSixes, setConsecutiveSixes] = useState<number>(0);
  const [winnerOrder, setWinnerOrder] = useState<PlayerColor[]>([]);
  const [moveHistory, setMoveHistory] = useState<MoveLogEntry[]>([]);
  const [totalTurns, setTotalTurns] = useState<number>(1);
  const [statusBanner, setStatusBanner] = useState<string>(
    'Player 1 (Blue) — Roll the dice next to your home area!'
  );
  const [particles, setParticles] = useState<ParticleBurst[]>([]);

  // Modals & UI Toggles
  const [isMuted, setIsMuted] = useState<boolean>(() => soundFX.isMuted());
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showAndroidModal, setShowAndroidModal] = useState<boolean>(false);
  const [showRestartConfirmModal, setShowRestartConfirmModal] = useState<boolean>(false);
  const [showAdPreviewBanner, setShowAdPreviewBanner] = useState<boolean>(false);
  const [savedGameSnapshot, setSavedGameSnapshot] = useState<SavedGameState | null>(() =>
    loadGameFromStorage()
  );

  // Refs to prevent stale closures or overlapping timers during turn transitions
  const isAnimatingRef = useRef(false);
  const pendingTimerRef = useRef<number | null>(null);

  const clearPendingTurnTimer = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const stateRef = useRef({
    players,
    tokens,
    currentTurnColor,
    turnPhase,
    diceValue,
    consecutiveSixes,
    winnerOrder,
  });

  useEffect(() => {
    stateRef.current = {
      players,
      tokens,
      currentTurnColor,
      turnPhase,
      diceValue,
      consecutiveSixes,
      winnerOrder,
    };
  }, [
    players,
    tokens,
    currentTurnColor,
    turnPhase,
    diceValue,
    consecutiveSixes,
    winnerOrder,
  ]);

  useEffect(() => {
    adMobService.initialize().catch(() => {});
    return () => clearPendingTurnTimer();
  }, [clearPendingTurnTimer]);

  /**
   * Update setup players when player count changes (2, 3, or 4):
   * Player 1 = BLUE (Bottom-Left)
   * Player 2 = GREEN (Top-Right)
   * Player 3 = YELLOW (Bottom-Right)
   * Player 4 = RED (Top-Left)
   */
  const handleSelectPlayerCount = (count: 2 | 3 | 4) => {
    setSetupPlayerCount(count);
    setSetupPlayers((prev) => {
      const activeSet =
        count === 2
          ? new Set<PlayerColor>(['BLUE', 'GREEN'])
          : count === 3
          ? new Set<PlayerColor>(['BLUE', 'GREEN', 'YELLOW'])
          : new Set<PlayerColor>(['BLUE', 'GREEN', 'YELLOW', 'RED']);

      let seq = 1;
      return PLAYER_ORDER.map((color) => {
        const prevPlayer = prev.find((p) => p.color === color);
        const isActive = activeSet.has(color);
        const hasCustomName =
          prevPlayer &&
          prevPlayer.name.trim() !== '' &&
          !/^Player \d+$/i.test(prevPlayer.name.trim()) &&
          prevPlayer.name.trim() !== COLOR_META[color].label;

        const nextName = isActive
          ? hasCustomName
            ? prevPlayer!.name
            : `Player ${seq++}`
          : COLOR_META[color].label;

        if (isActive && hasCustomName) {
          seq++;
        }

        return {
          color,
          name: nextName,
          active: isActive,
          isBot: prevPlayer ? prevPlayer.isBot : false,
          capturesMade: 0,
          sixesRolled: 0,
        };
      });
    });
  };

  const handleToggleSetupBot = (color: PlayerColor) => {
    setSetupPlayers((prev) =>
      prev.map((p) => (p.color === color ? { ...p, isBot: !p.isBot } : p))
    );
  };

  const handleSetupNameChange = (color: PlayerColor, newName: string) => {
    setSetupPlayers((prev) =>
      prev.map((p) => (p.color === color ? { ...p, name: newName } : p))
    );
  };

  // Auto-save active match state to localStorage
  useEffect(() => {
    if (screenState === 'PLAYING' && turnPhase !== 'ANIMATING_MOVE' && turnPhase !== 'ROLLING') {
      const snapshot: SavedGameState = {
        version: 1,
        savedAt: Date.now(),
        players,
        tokens,
        currentTurnColor,
        turnPhase,
        diceValue,
        consecutiveSixes,
        winnerOrder,
        moveHistory: moveHistory.slice(0, 25),
        totalTurns,
      };
      saveGameToStorage(snapshot);
      setSavedGameSnapshot(snapshot);
    }
  }, [
    screenState,
    players,
    tokens,
    currentTurnColor,
    turnPhase,
    diceValue,
    consecutiveSixes,
    winnerOrder,
    moveHistory,
    totalTurns,
  ]);

  // Active players ordered strictly by PLAYER_ORDER:
  // Player 1 (BLUE) -> Player 2 (GREEN) -> Player 3 (YELLOW) -> Player 4 (RED)
  const activePlayers = useCallback(() => {
    return PLAYER_ORDER.map((c) => players.find((p) => p.color === c)!).filter(
      (p) => p && p.active
    );
  }, [players])();

  const activeColors = useMemo(() => activePlayers.map((p) => p.color), [activePlayers]);

  const currentPlayer = useMemo(
    () => players.find((p) => p.color === currentTurnColor) || activePlayers[0] || players[0],
    [players, currentTurnColor, activePlayers]
  );

  // Determine which tokens of the CURRENT player can legally move
  const movableTokens = useMemo(() => {
    if (turnPhase !== 'SELECT_TOKEN' || diceValue === null) return [];
    return getMovableTokens(tokens[currentTurnColor], diceValue, currentTurnColor);
  }, [turnPhase, diceValue, tokens, currentTurnColor]);

  const movableTokenIds = useMemo(
    () => new Set(movableTokens.map((t) => t.id)),
    [movableTokens]
  );

  const spawnParticle = useCallback((row: number, col: number, color: string, label?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setParticles((prev) => [...prev, { id, row, col, color, label }]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 650);
  }, []);

  const appendLog = useCallback(
    (
      playerColor: PlayerColor,
      playerName: string,
      roll: number,
      description: string,
      type: MoveLogEntry['type']
    ) => {
      setMoveHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          playerColor,
          playerName,
          diceValue: roll,
          description,
          type,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  /**
   * Deterministic Turn Switcher:
   * Strictly cycles Player 1 (BLUE) -> Player 2 (GREEN) -> Player 3 (YELLOW) -> Player 4 (RED) -> Player 1 (BLUE)
   * among the active players who have not yet finished all 4 tokens.
   */
  const advanceToNextPlayer = useCallback(
    (fromColor: PlayerColor, currentWinners: PlayerColor[]) => {
      clearPendingTurnTimer();
      const latestPlayers = stateRef.current.players;
      const orderedActive = PLAYER_ORDER.map(
        (c) => latestPlayers.find((p) => p.color === c)!
      ).filter((p) => p && p.active);

      if (orderedActive.length === 0) return;

      const currentIndex = orderedActive.findIndex((p) => p.color === fromColor);
      let nextPlayer = orderedActive[0];

      for (let step = 1; step <= orderedActive.length; step++) {
        const candidateIdx =
          currentIndex === -1
            ? step % orderedActive.length
            : (currentIndex + step) % orderedActive.length;
        const candidate = orderedActive[candidateIdx];
        if (!currentWinners.includes(candidate.color)) {
          nextPlayer = candidate;
          break;
        }
      }

      const seatNumber = PLAYER_ORDER.indexOf(nextPlayer.color) + 1;
      setCurrentTurnColor(nextPlayer.color);
      setTurnPhase('ROLL_DICE');
      setDiceValue(null);
      setConsecutiveSixes(0);
      setTotalTurns((t) => t + 1);
      setStatusBanner(
        `P${seatNumber} ${nextPlayer.name} (${COLOR_META[nextPlayer.color].label}) — Roll dice at your corner!`
      );
    },
    [clearPendingTurnTimer]
  );

  // Start a brand new game using `customSetup` or `setupPlayers`
  const startNewGame = useCallback(
    (customSetup?: PlayerConfig[], preferredFirstColor?: PlayerColor) => {
      clearPendingTurnTimer();
      isAnimatingRef.current = false;

      const rawSetup = customSetup || setupPlayers;
      let activeNumber = 1;
      const chosenSetup = PLAYER_ORDER.map((color) => {
        const found = rawSetup.find((p) => p.color === color)!;
        const defaultName = found.active
          ? `Player ${activeNumber++}`
          : COLOR_META[color].label;
        return {
          ...found,
          name: found.name.trim() || defaultName,
          finishRank: undefined,
          capturesMade: 0,
          sixesRolled: 0,
        };
      });

      const firstActivePlayer =
        (preferredFirstColor &&
          chosenSetup.find((p) => p.color === preferredFirstColor && p.active)) ||
        chosenSetup.find((p) => p.active) ||
        chosenSetup[0];

      const seatNumber = PLAYER_ORDER.indexOf(firstActivePlayer.color) + 1;

      setPlayers(chosenSetup);
      setTokens(createInitialTokens());
      setCurrentTurnColor(firstActivePlayer.color);
      setTurnPhase('ROLL_DICE');
      setDiceValue(null);
      setConsecutiveSixes(0);
      setWinnerOrder([]);
      setMoveHistory([]);
      setTotalTurns(1);
      setStatusBanner(
        `P${seatNumber} ${firstActivePlayer.name} (${COLOR_META[firstActivePlayer.color].label}) — Roll the dice to start!`
      );
      setShowRestartConfirmModal(false);
      setScreenState('PLAYING');
    },
    [clearPendingTurnTimer, setupPlayers]
  );

  // Start Computer Mode (1 Human vs 1, 2, or 3 Smart AI Bots following PLAYER_ORDER)
  const handleStartComputerMatch = useCallback(
    (humanColor: PlayerColor, totalPlayers: 2 | 3 | 4) => {
      const activeSet = new Set<PlayerColor>([humanColor]);
      const startIdx = PLAYER_ORDER.indexOf(humanColor);
      for (let i = 1; i < totalPlayers; i++) {
        activeSet.add(PLAYER_ORDER[(startIdx + i) % PLAYER_ORDER.length]);
      }

      let botNum = 1;
      const compRoster: PlayerConfig[] = PLAYER_ORDER.map((color) => {
        const isActive = activeSet.has(color);
        const isHuman = color === humanColor;
        return {
          color,
          name: !isActive
            ? COLOR_META[color].label
            : isHuman
            ? profile.displayName || 'Player 1'
            : `Bot ${botNum++}`,
          active: isActive,
          isBot: isActive && !isHuman,
          capturesMade: 0,
          sixesRolled: 0,
        };
      });

      startNewGame(compRoster, humanColor);
    },
    [profile.displayName, startNewGame]
  );

  // Resume saved game from localStorage
  const handleResumeSavedGame = () => {
    const saved = loadGameFromStorage();
    if (!saved) return;
    clearPendingTurnTimer();
    isAnimatingRef.current = false;

    setPlayers(saved.players);
    setTokens(saved.tokens);
    setCurrentTurnColor(saved.currentTurnColor);
    const restoredPhase =
      saved.turnPhase === 'ANIMATING_MOVE' || saved.turnPhase === 'ROLLING'
        ? 'ROLL_DICE'
        : saved.turnPhase;
    setTurnPhase(restoredPhase);
    setDiceValue(restoredPhase === 'ROLL_DICE' ? null : saved.diceValue);
    setConsecutiveSixes(saved.consecutiveSixes);
    setWinnerOrder(saved.winnerOrder);
    setMoveHistory(saved.moveHistory || []);
    setTotalTurns(saved.totalTurns || 1);
    const activePlayer = saved.players.find((p) => p.color === saved.currentTurnColor);
    setStatusBanner(
      restoredPhase === 'SELECT_TOKEN' && saved.diceValue
        ? `${activePlayer?.name || saved.currentTurnColor} rolled ${saved.diceValue} — Select a token`
        : `${activePlayer?.name || saved.currentTurnColor}'s turn — Roll the dice!`
    );
    setScreenState('PLAYING');
  };

  /**
   * Execute token movement with step-by-step hop animation.
   * Enforces strict ownership: a player can NEVER move another player's token.
   * Turn switching or bonus-turn assignment ONLY happens after this move is 100% complete.
   */
  const handleExecuteTokenMove = useCallback(
    async (token: Token, rolledValue: number) => {
      const activeTurn = stateRef.current.currentTurnColor;
      const activePhase = stateRef.current.turnPhase;

      // Strict ownership and eligibility check
      if (
        isAnimatingRef.current ||
        token.color !== activeTurn ||
        !canPlayerMoveToken(activeTurn, token, rolledValue, activePhase)
      ) {
        return;
      }

      clearPendingTurnTimer();
      isAnimatingRef.current = true;
      setTurnPhase('ANIMATING_MOVE');

      const currentTokensState = stateRef.current.tokens;
      const currentPlayersState = stateRef.current.players;
      const currentWinnersState = stateRef.current.winnerOrder;
      const activePlayerObj =
        currentPlayersState.find((p) => p.color === token.color) || currentPlayer;
      const currentActiveColors = currentPlayersState
        .filter((p) => p.active)
        .map((p) => p.color);

      await multiplayerService.broadcastTokenMove(token.color, token.index);

      const outcome = evaluateMoveOutcome(
        token,
        rolledValue,
        currentTokensState,
        currentActiveColors
      );
      const isSpawningFromYard = token.progress === -1;

      if (isSpawningFromYard) {
        soundFX.playTokenSpawn();
        setTokens((prev) => ({
          ...prev,
          [token.color]: prev[token.color].map((t) =>
            t.id === token.id ? { ...t, progress: 0 } : t
          ),
        }));
        const startCoord = COLOR_META[token.color].startCoord;
        spawnParticle(startCoord.row, startCoord.col, COLOR_META[token.color].primaryHex, 'OUT!');
        await new Promise((r) => window.setTimeout(r, 240));
      } else {
        const startStep = token.progress;
        const endStep = outcome.newProgress;
        for (let step = startStep + 1; step <= endStep; step++) {
          soundFX.playTokenHop(step - startStep);
          setTokens((prev) => ({
            ...prev,
            [token.color]: prev[token.color].map((t) =>
              t.id === token.id ? { ...t, progress: step } : t
            ),
          }));
          await new Promise((r) => window.setTimeout(r, 70));
        }
      }

      const nextTokensSnapshot: Record<PlayerColor, Token[]> = {
        ...stateRef.current.tokens,
        [token.color]: stateRef.current.tokens[token.color].map((t) =>
          t.id === token.id ? { ...t, progress: outcome.newProgress } : t
        ),
      };

      if (outcome.capturedTokens.length > 0) {
        for (const captured of outcome.capturedTokens) {
          nextTokensSnapshot[captured.color] = nextTokensSnapshot[captured.color].map((t) =>
            t.id === captured.id ? { ...t, progress: -1 } : t
          );
        }
      }

      setTokens(nextTokensSnapshot);

      const destCoord = getTokenBoardCoord({ ...token, progress: outcome.newProgress });

      if (outcome.capturedTokens.length > 0) {
        soundFX.playCapture();
        spawnParticle(
          destCoord.row,
          destCoord.col,
          COLOR_META[token.color].primaryHex,
          'CAPTURED!'
        );
        setPlayers((prev) =>
          prev.map((p) =>
            p.color === token.color
              ? { ...p, capturesMade: p.capturesMade + outcome.capturedTokens.length }
              : p
          )
        );
        const capturedNames = outcome.capturedTokens
          .map((c) => COLOR_META[c.color].label)
          .join(', ');
        appendLog(
          token.color,
          activePlayerObj.name,
          rolledValue,
          `Captured ${capturedNames} token! Bonus roll earned.`,
          'CAPTURE'
        );
      } else if (outcome.reachedHomeGoal) {
        soundFX.playHomeGoal();
        spawnParticle(destCoord.row, destCoord.col, '#FACC15', 'HOME!');
        appendLog(
          token.color,
          activePlayerObj.name,
          rolledValue,
          `Token #${token.index + 1} reached Home Goal! Bonus roll earned.`,
          'HOME_GOAL'
        );
      } else if (isSpawningFromYard) {
        appendLog(
          token.color,
          activePlayerObj.name,
          rolledValue,
          `Token #${token.index + 1} entered the board on a 6! Bonus roll earned.`,
          'SPAWN'
        );
      } else {
        if (outcome.landedOnSafeSquare) {
          soundFX.playSafeSquare();
          spawnParticle(destCoord.row, destCoord.col, '#FACC15', 'SAFE ★');
        }
        appendLog(
          token.color,
          activePlayerObj.name,
          rolledValue,
          `Moved Token #${token.index + 1} forward ${rolledValue} steps.`,
          'MOVE'
        );
      }

      // Check if all 4 tokens of this player have now reached Home Goal (56)
      const playerTokensAfterMove = nextTokensSnapshot[token.color];
      const hasFinishedAllFour = playerTokensAfterMove.every((t) => t.progress === 56);

      let updatedWinners = currentWinnersState;
      if (hasFinishedAllFour && !currentWinnersState.includes(token.color)) {
        updatedWinners = [...currentWinnersState, token.color];
        const rank = updatedWinners.length;
        setWinnerOrder(updatedWinners);
        setPlayers((prev) =>
          prev.map((p) => (p.color === token.color ? { ...p, finishRank: rank } : p))
        );
      }

      // Check if the match is complete
      const unfinishedCount = currentActiveColors.filter(
        (c) => !updatedWinners.includes(c)
      ).length;
      if (unfinishedCount <= 1 && updatedWinners.length > 0) {
        const lastColor = currentActiveColors.find((c) => !updatedWinners.includes(c));
        const finalWinners = lastColor ? [...updatedWinners, lastColor] : updatedWinners;
        setWinnerOrder(finalWinners);
        setPlayers((prev) =>
          prev.map((p) => {
            const rIdx = finalWinners.indexOf(p.color);
            return rIdx !== -1 ? { ...p, finishRank: rIdx + 1 } : p;
          })
        );
        // Award free in-game match completion coins to profile
        setProfile((prev) => ({
          ...prev,
          coins: prev.coins + 100,
          gems: prev.gems + 5,
        }));
        clearSavedGameFromStorage();
        setSavedGameSnapshot(null);
        soundFX.playVictoryFanfare();
        isAnimatingRef.current = false;
        setScreenState('VICTORY');
        return;
      }

      isAnimatingRef.current = false;

      if (hasFinishedAllFour) {
        advanceToNextPlayer(token.color, updatedWinners);
        return;
      }

      if (outcome.grantsBonusTurn) {
        setTurnPhase('ROLL_DICE');
        setDiceValue(null);
        const reason =
          outcome.capturedTokens.length > 0
            ? 'Captured opponent token'
            : outcome.reachedHomeGoal
            ? 'Token reached Home'
            : 'Rolled a 6';
        setStatusBanner(
          `Bonus Turn for ${activePlayerObj.name} (${reason}) — Roll again!`
        );
      } else {
        advanceToNextPlayer(token.color, updatedWinners);
      }
    },
    [
      clearPendingTurnTimer,
      currentPlayer,
      spawnParticle,
      appendLog,
      advanceToNextPlayer,
    ]
  );

  // Roll the dice (1..6) for the current player
  const handleRollDice = useCallback(() => {
    if (turnPhase !== 'ROLL_DICE' || isAnimatingRef.current) return;
    clearPendingTurnTimer();

    setTurnPhase('ROLLING');
    soundFX.playDiceRoll();

    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null;

      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      const roll = (randomBuffer[0] % 6) + 1;

      const activeColor = stateRef.current.currentTurnColor;
      const activePlayerObj =
        stateRef.current.players.find((p) => p.color === activeColor) || currentPlayer;
      const currentSixes = stateRef.current.consecutiveSixes;
      const currentWinners = stateRef.current.winnerOrder;
      const currentColorTokens = stateRef.current.tokens[activeColor];

      setDiceValue(roll);
      multiplayerService.broadcastDiceRoll(activeColor, roll).catch(() => {});

      const newSixCount = roll === 6 ? currentSixes + 1 : 0;
      setConsecutiveSixes(newSixCount);

      if (roll === 6) {
        soundFX.playDiceSix();
        setPlayers((prev) =>
          prev.map((p) =>
            p.color === activeColor ? { ...p, sixesRolled: p.sixesRolled + 1 } : p
          )
        );
      }

      // Three consecutive 6s passes the turn
      if (newSixCount >= 3) {
        setStatusBanner(
          `${activePlayerObj.name} rolled three 6s in a row — switching turn!`
        );
        appendLog(
          activeColor,
          activePlayerObj.name,
          roll,
          'Rolled three consecutive 6s — turn passed.',
          'FORFEIT_THREE_SIXES'
        );
        pendingTimerRef.current = window.setTimeout(() => {
          advanceToNextPlayer(activeColor, currentWinners);
        }, 1050);
        return;
      }

      const legalTokens = getMovableTokens(currentColorTokens, roll, activeColor);

      if (legalTokens.length === 0) {
        if (roll === 6) {
          setStatusBanner(
            `${activePlayerObj.name} rolled 6 (no token can move 6) — Bonus roll!`
          );
          appendLog(
            activeColor,
            activePlayerObj.name,
            roll,
            'Rolled 6 with no legal move — bonus roll granted.',
            'SKIP'
          );
          pendingTimerRef.current = window.setTimeout(() => {
            setTurnPhase('ROLL_DICE');
            setDiceValue(null);
          }, 950);
          return;
        }

        setStatusBanner(
          `${activePlayerObj.name} rolled ${roll} — no valid moves, switching turn...`
        );
        appendLog(
          activeColor,
          activePlayerObj.name,
          roll,
          `Rolled ${roll} (no legal moves).`,
          'SKIP'
        );
        pendingTimerRef.current = window.setTimeout(() => {
          advanceToNextPlayer(activeColor, currentWinners);
        }, 1000);
        return;
      }

      setTurnPhase('SELECT_TOKEN');
      setStatusBanner(
        legalTokens.length > 1
          ? `${activePlayerObj.name} rolled ${roll} — Choose 1 of ${legalTokens.length} eligible tokens near your home area!`
          : `${activePlayerObj.name} rolled ${roll} — Tap your highlighted token to move!`
      );
    }, 360);
  }, [
    turnPhase,
    clearPendingTurnTimer,
    currentPlayer,
    appendLog,
    advanceToNextPlayer,
  ]);

  // Bot automation loop when current player is a Bot
  useEffect(() => {
    if (screenState !== 'PLAYING' || !currentPlayer.isBot) return;

    if (turnPhase === 'ROLL_DICE' && !isAnimatingRef.current) {
      const timer = window.setTimeout(() => {
        handleRollDice();
      }, 650);
      return () => window.clearTimeout(timer);
    }

    if (
      turnPhase === 'SELECT_TOKEN' &&
      diceValue !== null &&
      movableTokens.length > 0 &&
      !isAnimatingRef.current
    ) {
      const timer = window.setTimeout(() => {
        const chosen = pickBestTokenMove(
          movableTokens,
          diceValue,
          tokens,
          activeColors
        );
        handleExecuteTokenMove(chosen, diceValue);
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [
    screenState,
    currentPlayer,
    turnPhase,
    diceValue,
    movableTokens,
    tokens,
    activeColors,
    handleRollDice,
    handleExecuteTokenMove,
  ]);

  // Keyboard shortcuts during active gameplay (strictly restricted to currentTurnColor)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (showRulesModal) setShowRulesModal(false);
        else if (showAndroidModal) setShowAndroidModal(false);
        else if (showRestartConfirmModal) setShowRestartConfirmModal(false);
        return;
      }

      if (screenState === 'PLAYING' && !currentPlayer.isBot) {
        if ((e.key === ' ' || e.key === 'Enter') && turnPhase === 'ROLL_DICE') {
          e.preventDefault();
          handleRollDice();
        } else if (
          turnPhase === 'SELECT_TOKEN' &&
          diceValue !== null &&
          ['1', '2', '3', '4'].includes(e.key)
        ) {
          const idx = parseInt(e.key, 10) - 1;
          const candidate = tokens[currentTurnColor][idx];
          if (
            candidate &&
            candidate.color === currentTurnColor &&
            movableTokenIds.has(candidate.id)
          ) {
            handleExecuteTokenMove(candidate, diceValue);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screenState,
    showRulesModal,
    showAndroidModal,
    showRestartConfirmModal,
    currentPlayer,
    turnPhase,
    diceValue,
    tokens,
    currentTurnColor,
    movableTokenIds,
    handleRollDice,
    handleExecuteTokenMove,
  ]);

  const handleToggleMute = () => {
    const nextMuted = soundFX.toggleMute();
    setIsMuted(nextMuted);
  };

  // Helper to render one of the 4 corner control stations next to its Home Area
  const renderCornerStation = (
    stationColor: PlayerColor,
    cornerPosition: 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT'
  ) => {
    const playerObj = players.find((p) => p.color === stationColor)!;
    // Fixed Home Area Seat Mapping:
    // Player 1 = BLUE (Bottom-Left)
    // Player 2 = GREEN (Top-Right)
    // Player 3 = YELLOW (Bottom-Right)
    // Player 4 = RED (Top-Left)
    const seatNumber = PLAYER_ORDER.indexOf(stationColor) + 1;
    const isCurrentTurn = currentTurnColor === stationColor && playerObj.active;

    return (
      <PlayerCornerStation
        key={stationColor}
        stationColor={stationColor}
        cornerPosition={cornerPosition}
        player={playerObj}
        playerNumber={seatNumber}
        isCurrentTurn={isCurrentTurn}
        turnPhase={turnPhase}
        diceValue={isCurrentTurn ? diceValue : null}
        playerTokens={tokens[stationColor]}
        movableTokenIds={isCurrentTurn ? movableTokenIds : new Set()}
        consecutiveSixes={isCurrentTurn ? consecutiveSixes : 0}
        onRollDice={() => {
          if (isCurrentTurn && !playerObj.isBot) {
            handleRollDice();
          }
        }}
        onSelectToken={(token) => {
          if (
            isCurrentTurn &&
            token.color === currentTurnColor &&
            turnPhase === 'SELECT_TOKEN' &&
            diceValue !== null &&
            !playerObj.isBot &&
            movableTokenIds.has(token.id)
          ) {
            handleExecuteTokenMove(token, diceValue);
          }
        }}
      />
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#0B1320] text-slate-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* =====================================================================
          0. RAHEEM LUDO LOGIN, ACCOUNT LINKING & DEVICE RESTORE SCREEN
         ===================================================================== */}
      {screenState === 'LOGIN_SCREEN' && (
        <LoginScreen
          profile={profile}
          onUpdateProfile={setProfile}
          firebaseUser={firebaseUser}
          savedMatchTurn={savedGameSnapshot?.totalTurns || 0}
          onContinueToLobby={() => setScreenState('TITLE_MENU')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* =====================================================================
          1. REDESIGNED RAHEEM LUDO HOME LOBBY & 5-TAB NAVIGATION
         ===================================================================== */}
      {screenState === 'TITLE_MENU' && (
        <LobbyViews
          activeTab={activeLobbyTab}
          onSelectTab={setActiveLobbyTab}
          profile={profile}
          onUpdateProfile={setProfile}
          savedGameSnapshot={savedGameSnapshot}
          onResumeSavedGame={handleResumeSavedGame}
          onStartComputerMatch={handleStartComputerMatch}
          onStartPassAndPlayMatch={(customPlayers) => startNewGame(customPlayers)}
          onStartTeamUpLocalMatch={(teamPlayers) => startNewGame(teamPlayers)}
          setupPlayerCount={setupPlayerCount}
          setupPlayers={setupPlayers}
          onSelectPlayerCount={handleSelectPlayerCount}
          onSetupNameChange={handleSetupNameChange}
          onToggleSetupBot={handleToggleSetupBot}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenRulesModal={() => setShowRulesModal(true)}
          onOpenAndroidModal={() => setShowAndroidModal(true)}
          onOpenLoginScreen={() => setScreenState('LOGIN_SCREEN')}
          firebaseUser={firebaseUser}
          onlinePlayers={onlinePlayers}
          liveRooms={liveRooms}
        />
      )}

      {/* =====================================================================
          2. ACTIVE GAMEPLAY VIEW (PORTRAIT & LANDSCAPE MOBILE + DESKTOP)
             Controls automatically reposition next to the active player's Home Area:
             - Top-Left Corner: Player 4 (RED Home Area)
             - Top-Right Corner: Player 2 (GREEN Home Area)
             - Bottom-Left Corner: Player 1 (BLUE Home Area)
             - Bottom-Right Corner: Player 3 (YELLOW Home Area)
         ===================================================================== */}
      {(screenState === 'PLAYING' || screenState === 'VICTORY') && (
        <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-2 sm:px-5 py-1.5 sm:py-3 justify-between gap-1.5 sm:gap-2.5 overflow-x-hidden">
          {/* Compact Top App Header */}
          <header className="h-11 sm:h-12 flex items-center justify-between gap-2 px-2.5 sm:px-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  clearPendingTurnTimer();
                  setScreenState('TITLE_MENU');
                }}
                aria-label="Return to Home Screen"
                className="min-h-[36px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 text-xs font-semibold transition-colors shrink-0"
              >
                <Home className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Home</span>
              </button>
              <span className="font-display font-bold text-xs sm:text-base text-white truncate">
                Raheem Ludo
              </span>
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                · Turn {totalTurns}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowRestartConfirmModal(true)}
                className="min-h-[36px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Restart</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                aria-label="Game Rules"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowAndroidModal(true)}
                aria-label="Android & Backend Setup Guide"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center transition-colors"
              >
                <Smartphone className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
                className="min-h-[36px] min-w-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>
            </div>
          </header>

          {/* Main Playfield Grid (Responsive across Portrait & Landscape) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 lg:gap-5 items-center my-auto w-full">
            {/* Board + 4 Corner Control Stations Next to Each Home Area */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center gap-1.5 sm:gap-2 w-full max-w-[520px] mx-auto">
              {/* TOP CORNERS: Player 4 (RED Top-Left Home Area) & Player 2 (GREEN Top-Right Home Area) */}
              <div className="w-full grid grid-cols-2 gap-1.5 sm:gap-2.5 items-stretch">
                {renderCornerStation('RED', 'TOP_LEFT')}
                {renderCornerStation('GREEN', 'TOP_RIGHT')}
              </div>

              {/* 15x15 Interactive Ludo Board (Unobstructed) */}
              <LudoBoard
                tokens={tokens}
                players={players}
                currentTurnColor={currentTurnColor}
                turnPhase={turnPhase}
                movableTokenIds={movableTokenIds}
                selectedTokenId={null}
                particles={particles}
                onSelectToken={(token) => {
                  if (
                    token.color === currentTurnColor &&
                    turnPhase === 'SELECT_TOKEN' &&
                    diceValue !== null &&
                    !currentPlayer.isBot &&
                    movableTokenIds.has(token.id)
                  ) {
                    handleExecuteTokenMove(token, diceValue);
                  }
                }}
              />

              {/* BOTTOM CORNERS: Player 1 (BLUE Bottom-Left Home Area) & Player 3 (YELLOW Bottom-Right Home Area) */}
              <div className="w-full grid grid-cols-2 gap-1.5 sm:gap-2.5 items-stretch">
                {renderCornerStation('BLUE', 'BOTTOM_LEFT')}
                {renderCornerStation('YELLOW', 'BOTTOM_RIGHT')}
              </div>

              {/* Compact Status Strip Underneath Bottom Corner Stations */}
              <div
                aria-live="polite"
                className="w-full rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-1.5 text-center text-[11px] sm:text-xs font-medium text-slate-200 truncate"
              >
                {statusBanner}
              </div>
            </div>

            {/* Side Info Panel: Turn Cycle Indicator & Move Log (Visible on Landscape / Tablet / Desktop) */}
            <div className="lg:col-span-5 w-full max-w-[520px] mx-auto hidden md:flex flex-col gap-3">
              <div className="flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Home Area Turn Cycle (P1 Blue → P2 Green → P3 Yellow → P4 Red)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearPendingTurnTimer();
                      setScreenState('TITLE_MENU');
                    }}
                    className="text-xs font-semibold text-amber-400 hover:underline shrink-0"
                  >
                    Lobby
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PLAYER_ORDER.map((color, idx) => {
                    const p = players.find((pl) => pl.color === color)!;
                    const isCurrent = p.color === currentTurnColor && p.active;
                    const meta = COLOR_META[color];
                    const cornerLabel =
                      color === 'BLUE'
                        ? 'Bottom-Left'
                        : color === 'GREEN'
                        ? 'Top-Right'
                        : color === 'YELLOW'
                        ? 'Bottom-Right'
                        : 'Top-Left';

                    return (
                      <div
                        key={color}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                          !p.active
                            ? 'bg-slate-950/30 border-slate-800/50 opacity-40'
                            : isCurrent
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400'
                        }`}
                        style={{
                          borderColor: isCurrent ? meta.primaryHex : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-extrabold text-white shrink-0"
                            style={{ backgroundColor: meta.primaryHex }}
                          >
                            P{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400">{cornerLabel}</div>
                          </div>
                        </div>
                        {isCurrent && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold text-slate-950 uppercase shrink-0"
                            style={{ backgroundColor: meta.ringHex }}
                          >
                            Active
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs border-t border-slate-800/80 pt-2.5">
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">
                    Recent Match Events
                  </div>
                  {moveHistory.length === 0 ? (
                    <div className="text-slate-500 py-1">
                      No moves recorded yet. Roll the dice next to Player 1&apos;s Blue Home Area!
                    </div>
                  ) : (
                    moveHistory.slice(0, 6).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/60 text-slate-300"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{
                              backgroundColor: COLOR_META[entry.playerColor].primaryHex,
                            }}
                          />
                          <span className="font-semibold text-white shrink-0">
                            {entry.playerName}:
                          </span>
                          <span className="truncate">{entry.description}</span>
                        </div>
                        <span className="font-mono tabular-nums text-slate-400 shrink-0">
                          [{entry.diceValue}]
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {showAdPreviewBanner && (
            <div className="h-[50px] w-full max-w-[520px] mx-auto rounded-xl bg-slate-900 border border-dashed border-amber-500/50 flex items-center justify-between px-4 text-xs text-amber-300 shrink-0">
              <span className="font-mono">
                AdMob Layout Guide (320×50) · {adMobService.getConfig().bannerAdUnitId}
              </span>
              <button
                type="button"
                onClick={() => setShowAdPreviewBanner(false)}
                className="underline text-slate-400 hover:text-white"
              >
                Hide
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          3. VICTORY / PODIUM SUMMARY MODAL
         ===================================================================== */}
      {screenState === 'VICTORY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mx-auto">
              <Trophy className="w-9 h-9 text-amber-400" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold font-display text-white">
                {players.find((p) => p.color === winnerOrder[0])?.name || 'Winner'} Wins!
              </h2>
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                Match Complete in {totalTurns} Turns · +100 Free Coins &amp; +5 Gems Earned
              </p>
            </div>

            <div className="space-y-2 text-left">
              {winnerOrder.map((color, idx) => {
                const p = players.find((pl) => pl.color === color);
                if (!p) return null;
                const meta = COLOR_META[color];
                return (
                  <div
                    key={color}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-amber-400 w-6">
                        #{idx + 1}
                      </span>
                      <span
                        className="w-3.5 h-3.5 rounded-sm"
                        style={{ backgroundColor: meta.primaryHex }}
                      />
                      <span className="font-bold text-sm text-white">{p.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono tabular-nums">
                      {p.capturesMade} Captures · {p.sixesRolled} Sixes
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScreenState('TITLE_MENU')}
                className="min-h-[48px] py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                Return to Lobby
              </button>
              <button
                type="button"
                onClick={() => startNewGame(players)}
                className="min-h-[48px] py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. RESTART / NEW GAME CONFIRMATION MODAL
         ===================================================================== */}
      {showRestartConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display text-white">
                Restart Current Match?
              </h3>
              <button
                type="button"
                onClick={() => setShowRestartConfirmModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You can reset all tokens to their starting yards with the same players, or return
              to the Home Screen to switch game modes.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => startNewGame(players)}
                className="w-full min-h-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Restart Match Now
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPendingTurnTimer();
                  setShowRestartConfirmModal(false);
                  setScreenState('TITLE_MENU');
                }}
                className="w-full min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Return to Home Lobby
              </button>
              <button
                type="button"
                onClick={() => setShowRestartConfirmModal(false)}
                className="w-full min-h-[42px] rounded-xl text-slate-400 hover:text-white text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. LUDO RULES MODAL
         ===================================================================== */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold font-display text-white">
                  Raheem Ludo — Classic Rules
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed pr-1">
              <div>
                <strong className="text-white">1. Home Area Turn Order:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                  <li><strong>Player 1:</strong> Blue Home Area (Bottom-Left)</li>
                  <li><strong>Player 2:</strong> Green Home Area (Top-Right)</li>
                  <li><strong>Player 3:</strong> Yellow Home Area (Bottom-Right)</li>
                  <li><strong>Player 4:</strong> Red Home Area (Top-Left)</li>
                </ul>
              </div>
              <div>
                <strong className="text-white">2. Exiting the Base Yard:</strong> Each player starts
                with 4 tokens in their colored corner yard. Roll a <strong>6</strong> to bring a
                token out onto your colored starting square.
              </div>
              <div>
                <strong className="text-white">3. Bonus Rolls:</strong> Rolling a <strong>6</strong>,
                capturing an opponent&apos;s token, or reaching the center Home Goal triangle grants
                an immediate bonus roll. Rolling three consecutive 6s passes the turn.
              </div>
              <div>
                <strong className="text-white">4. Capturing Opponents:</strong> Landing on a square
                occupied by an opponent&apos;s token sends that opponent token back to its base yard!
              </div>
              <div>
                <strong className="text-white">5. Safe Squares (★):</strong> The 4 colored starting
                squares and the 4 gold star squares are safe zones. No token can be captured while
                resting on any of the 8 safe squares, and multiple tokens of any color can share them.
              </div>
              <div>
                <strong className="text-white">6. Entering the Home Goal:</strong> After completing a
                full 51-square lap around the board, tokens enter their colored home column. You must
                roll the <strong>exact number</strong> required to enter the center Home Goal triangle.
                First player to bring all 4 tokens home wins!
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Close Rules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. ONLINE BACKEND, FACEBOOK & ANDROID PACKAGING MODAL
         ===================================================================== */}
      <AndroidExportModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
        showAdPreviewBanner={showAdPreviewBanner}
        onToggleAdPreviewBanner={() => setShowAdPreviewBanner((v) => !v)}
      />
    </div>
  );
}
