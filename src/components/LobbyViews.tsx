import React, { useState } from 'react';
import {
  Bot,
  Calendar,
  Check,
  Compass,
  Copy,
  Crown,
  Flame,
  Gift,
  Globe,
  Layers,
  LogIn,
  LogOut,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { COLOR_META, PLAYER_ORDER } from '../engine/ludoEngine';
import {
  createLiveRoomInFirestore,
  FirebaseUser,
  LiveRoomDoc,
  OnlinePlayerDoc,
  signInWithFacebook,
  signInWithGoogle,
  signOutFromFirebase,
} from '../firebase';
import { PlayerColor, PlayerConfig, SavedGameState } from '../types/ludo';

export type BottomNavTab = 'HOME' | 'EVENT' | 'ADDA' | 'INVENTORY' | 'SOCIAL';

export interface LocalPlayerProfile {
  playerId: string;
  displayName: string;
  avatarColor: PlayerColor;
  photoUrl?: string;
  authProvider?: 'GOOGLE' | 'FACEBOOK';
  isGuest?: boolean;
  lastCloudSyncAt?: number;
  coins: number;
  gems: number;
  lastDailyClaimDate: string | null;
  dailyStreak: number;
  lastSpinTimestamp: number | null;
  equippedDiceStyle: string;
  equippedTokenStyle: string;
  unlockedItems: string[];
  friends: {
    id: string;
    name: string;
    addedAt: number;
    presence: 'OFFLINE' | 'ONLINE_VERIFIED';
  }[];
  fbConnected: boolean;
}

interface LobbyViewsProps {
  activeTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  profile: LocalPlayerProfile;
  onUpdateProfile: (updater: (prev: LocalPlayerProfile) => LocalPlayerProfile) => void;
  savedGameSnapshot: SavedGameState | null;
  onResumeSavedGame: () => void;
  onStartComputerMatch: (humanColor: PlayerColor, totalPlayers: 2 | 3 | 4) => void;
  onStartPassAndPlayMatch: (players: PlayerConfig[]) => void;
  onStartTeamUpLocalMatch: (players: PlayerConfig[]) => void;
  setupPlayerCount: 2 | 3 | 4;
  setupPlayers: PlayerConfig[];
  onSelectPlayerCount: (count: 2 | 3 | 4) => void;
  onSetupNameChange: (color: PlayerColor, name: string) => void;
  onToggleSetupBot: (color: PlayerColor) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenRulesModal: () => void;
  onOpenAndroidModal: () => void;
  onOpenLoginScreen: () => void;
  firebaseUser: FirebaseUser | null;
  onlinePlayers: OnlinePlayerDoc[];
  liveRooms: LiveRoomDoc[];
}

type ActiveLobbyModal =
  | null
  | 'ONLINE_MATCHMAKING'
  | 'TEAM_UP'
  | 'FRIENDS_MODAL'
  | 'COMPUTER_SETUP'
  | 'PASS_N_PLAY_SETUP'
  | 'TOURNAMENT_DETAILS'
  | 'DAILY_REWARDS'
  | 'SPIN_WHEEL'
  | 'SETTINGS'
  | 'MESSAGES'
  | 'SHOP'
  | 'PROFILE_EDIT';

const SPIN_WHEEL_SLICES = [
  { id: 'c50', label: '+50 Coins', type: 'COINS' as const, amount: 50, color: '#EF4444' },
  { id: 'g5', label: '+5 Gems', type: 'GEMS' as const, amount: 5, color: '#10B981' },
  { id: 'c100', label: '+100 Coins', type: 'COINS' as const, amount: 100, color: '#F59E0B' },
  { id: 'g10', label: '+10 Gems', type: 'GEMS' as const, amount: 10, color: '#3B82F6' },
  { id: 'c75', label: '+75 Coins', type: 'COINS' as const, amount: 75, color: '#8B5CF6' },
  { id: 'g15', label: '+15 Gems', type: 'GEMS' as const, amount: 15, color: '#EC4899' },
];

const UPCOMING_TOURNAMENTS = [
  {
    id: 't-crown-cup',
    title: 'Raheem Crown Cup (4P)',
    schedule: 'Starts Daily at 18:00 Local Time',
    format: '4-Player Classic Rules · Knockouts',
    entry: 'Free Entry (0 Coins)',
    reward: 'Crown Trophy Badge + 250 Free Coins',
  },
  {
    id: 't-blitz-duel',
    title: 'Rapid 1v1 Blitz Arena',
    schedule: 'Every 2 Hours · Open Bracket',
    format: '2-Player Head-to-Head',
    entry: 'Free Entry (0 Coins)',
    reward: 'Blitz Emblem + 100 Free Coins',
  },
];

const SHOP_ITEMS = [
  {
    id: 'dice_ROYAL_GOLD',
    category: 'DICE' as const,
    styleKey: 'ROYAL_GOLD' as const,
    name: 'Royal Gold Dice Trim',
    costCoins: 150,
    costGems: 0,
    desc: 'Warm gold inner trim on your 1–6 dice.',
  },
  {
    id: 'dice_EMERALD_JADE',
    category: 'DICE' as const,
    styleKey: 'EMERALD_JADE' as const,
    name: 'Emerald Jade Dice',
    costCoins: 0,
    costGems: 15,
    desc: 'Polished emerald border accent during your turn.',
  },
  {
    id: 'token_STAR_SHIELD',
    category: 'TOKEN' as const,
    styleKey: 'STAR_SHIELD' as const,
    name: 'Star Shield Pawn Emblem',
    costCoins: 200,
    costGems: 0,
    desc: 'Custom shield ring style for your 4 Ludo pawns.',
  },
  {
    id: 'token_CRYSTAL',
    category: 'TOKEN' as const,
    styleKey: 'CRYSTAL' as const,
    name: 'Crystal Crown Pawns',
    costCoins: 0,
    costGems: 20,
    desc: 'High-contrast crystal ring highlight on the board.',
  },
];

export const LobbyViews: React.FC<LobbyViewsProps> = ({
  activeTab,
  onSelectTab,
  profile,
  onUpdateProfile,
  savedGameSnapshot,
  onResumeSavedGame,
  onStartComputerMatch,
  onStartPassAndPlayMatch,
  onStartTeamUpLocalMatch,
  setupPlayerCount,
  setupPlayers,
  onSelectPlayerCount,
  onSetupNameChange,
  onToggleSetupBot,
  isMuted,
  onToggleMute,
  onOpenRulesModal,
  onOpenAndroidModal,
  onOpenLoginScreen,
  firebaseUser,
  onlinePlayers,
  liveRooms,
}) => {
  const [activeModal, setActiveModal] = useState<ActiveLobbyModal>(null);
  const [authStatusMsg, setAuthStatusMsg] = useState<string | null>(null);
  const [isBusyAuth, setIsBusyAuth] = useState<boolean>(false);

  // Computer Mode Setup State (Player 1 defaults to Blue Home Area)
  const [compHumanColor, setCompHumanColor] = useState<PlayerColor>('BLUE');
  const [compPlayerCount, setCompPlayerCount] = useState<2 | 3 | 4>(4);

  // Team Up Room Code State
  const [teamRoomCode, setTeamRoomCode] = useState<string>('RL-4829');
  const [joinRoomInput, setJoinRoomInput] = useState<string>('');
  const [copiedRoomCode, setCopiedRoomCode] = useState<boolean>(false);

  // Friends Input State
  const [newFriendName, setNewFriendName] = useState<string>('');
  const [newFriendId, setNewFriendId] = useState<string>('');

  // Spin Wheel State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinRotation, setSpinRotation] = useState<number>(0);
  const [lastSpinRewardText, setLastSpinRewardText] = useState<string | null>(null);

  // Profile Edit State
  const [tempDisplayName, setTempDisplayName] = useState<string>(profile.displayName);

  const todayStr = new Date().toISOString().slice(0, 10);
  const canClaimDaily = profile.lastDailyClaimDate !== todayStr;
  const firebaseConnected = Boolean(firebaseUser);

  const handleGoogleSignIn = async () => {
    setIsBusyAuth(true);
    setAuthStatusMsg(null);
    try {
      const user = await signInWithGoogle(profile.playerId, profile.avatarColor);
      onUpdateProfile((prev) => ({
        ...prev,
        displayName: user.displayName || prev.displayName,
      }));
      setAuthStatusMsg(`Signed in as ${user.displayName || user.email}`);
    } catch (err) {
      setAuthStatusMsg(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or blocked.'
      );
    } finally {
      setIsBusyAuth(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setIsBusyAuth(true);
    setAuthStatusMsg(null);
    try {
      const user = await signInWithFacebook(profile.playerId, profile.avatarColor);
      onUpdateProfile((prev) => ({
        ...prev,
        displayName: user.displayName || prev.displayName,
        fbConnected: true,
      }));
      setAuthStatusMsg(`Facebook connected as ${user.displayName || 'Player'}`);
    } catch (err) {
      setAuthStatusMsg(
        err instanceof Error
          ? `Facebook Login requires enabling the Facebook App ID in Firebase Console -> Authentication (${err.message}).`
          : 'Facebook Login requires Meta App ID configuration in Firebase Console.'
      );
    } finally {
      setIsBusyAuth(false);
    }
  };

  const handleCreateLiveFirestoreRoom = async (
    mode: LiveRoomDoc['mode'],
    maxPlayers: 2 | 4
  ) => {
    if (!firebaseUser) {
      setAuthStatusMsg('Sign in with Google first to create a live Firestore matchmaking room.');
      return;
    }
    try {
      const code = `RL-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await createLiveRoomInFirestore(code, mode, maxPlayers);
      setTeamRoomCode(created);
      setAuthStatusMsg(`Live Room ${created} created in Firestore! Share code with friends.`);
    } catch (err) {
      setAuthStatusMsg(err instanceof Error ? err.message : 'Failed to create room.');
    }
  };

  const handleClaimDailyReward = () => {
    if (!canClaimDaily) return;
    const nextStreak = (profile.dailyStreak % 7) + 1;
    const rewardCoins = 50 + nextStreak * 15;
    const rewardGems = nextStreak === 7 ? 10 : 2;
    onUpdateProfile((prev) => ({
      ...prev,
      coins: prev.coins + rewardCoins,
      gems: prev.gems + rewardGems,
      lastDailyClaimDate: todayStr,
      dailyStreak: nextStreak,
    }));
  };

  const handleSpinWheel = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setLastSpinRewardText(null);

    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    const sliceIndex = randomBuffer[0] % SPIN_WHEEL_SLICES.length;
    const slice = SPIN_WHEEL_SLICES[sliceIndex];

    const extraTurns = 5 * 360;
    const targetAngle = extraTurns + (360 - sliceIndex * 60);
    setSpinRotation((prev) => prev + targetAngle);

    window.setTimeout(() => {
      setIsSpinning(false);
      setLastSpinRewardText(`You won ${slice.label} (Free In-Game Bonus)!`);
      onUpdateProfile((prev) => ({
        ...prev,
        coins: slice.type === 'COINS' ? prev.coins + slice.amount : prev.coins,
        gems: slice.type === 'GEMS' ? prev.gems + slice.amount : prev.gems,
        lastSpinTimestamp: Date.now(),
      }));
    }, 2600);
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newFriendName.trim();
    const trimmedId =
      newFriendId.trim().toUpperCase() || `RL-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!trimmedName) return;

    const isCurrentlyOnline = onlinePlayers.some((op) => op.playerCode === trimmedId);

    onUpdateProfile((prev) => ({
      ...prev,
      friends: [
        ...prev.friends,
        {
          id: trimmedId,
          name: trimmedName,
          addedAt: Date.now(),
          presence: isCurrentlyOnline ? 'ONLINE_VERIFIED' : 'OFFLINE',
        },
      ],
    }));
    setNewFriendName('');
    setNewFriendId('');
  };

  const handleUnlockOrEquipItem = (item: (typeof SHOP_ITEMS)[number]) => {
    const isUnlocked = profile.unlockedItems.includes(item.id);
    if (isUnlocked) {
      onUpdateProfile((prev) => ({
        ...prev,
        equippedDiceStyle:
          item.category === 'DICE' ? item.styleKey : prev.equippedDiceStyle,
        equippedTokenStyle:
          item.category === 'TOKEN' ? item.styleKey : prev.equippedTokenStyle,
      }));
      return;
    }

    if (profile.coins < item.costCoins || profile.gems < item.costGems) {
      return;
    }

    onUpdateProfile((prev) => ({
      ...prev,
      coins: prev.coins - item.costCoins,
      gems: prev.gems - item.costGems,
      unlockedItems: [...prev.unlockedItems, item.id],
      equippedDiceStyle:
        item.category === 'DICE' ? item.styleKey : prev.equippedDiceStyle,
      equippedTokenStyle:
        item.category === 'TOKEN' ? item.styleKey : prev.equippedTokenStyle,
    }));
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-b from-[#0E1E38] via-[#0B1528] to-[#080F1E] text-slate-100 pb-20 select-none">
      {/* =====================================================================
          1. TOP BAR: Avatar, Online Indicator, Coins, Gems, Shop, Messages, Settings
         ===================================================================== */}
      <header className="sticky top-0 z-30 w-full bg-[#0B1528]/95 backdrop-blur-md border-b border-slate-800/90 px-3 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Player Avatar, Username & Honest Connection Indicator */}
          <button
            type="button"
            onClick={() => {
              setTempDisplayName(profile.displayName);
              setActiveModal('PROFILE_EDIT');
            }}
            className="flex items-center gap-2 p-1 pr-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-amber-400/60 transition-colors min-h-[44px] shrink-0"
          >
            <div className="relative shrink-0">
              {firebaseUser?.photoURL || profile.photoUrl ? (
                <img
                  src={firebaseUser?.photoURL || profile.photoUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-lg object-cover border border-amber-400/80"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-extrabold text-sm text-white shadow-inner border border-white/30"
                  style={{ backgroundColor: COLOR_META[profile.avatarColor].primaryHex }}
                >
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span
                title={
                  firebaseConnected
                    ? `Online (${onlinePlayers.length} verified player${onlinePlayers.length === 1 ? '' : 's'} active)`
                    : 'Guest Mode — Tap to link Google or Facebook account'
                }
                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${
                  firebaseConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-bold text-white leading-tight truncate max-w-[78px] sm:max-w-[115px]">
                {profile.displayName}
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                {firebaseConnected ? (
                  <>
                    <Wifi className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 truncate">
                      Online ({onlinePlayers.length})
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    <span className="truncate">Guest</span>
                  </>
                )}
              </div>
            </div>
          </button>

          {/* Center: Free Coins & Gems Counters */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveModal('DAILY_REWARDS')}
              aria-label="Free Coins Balance and Daily Bonus"
              className="min-h-[40px] px-2.5 py-1 rounded-xl bg-slate-900 border border-amber-500/40 hover:border-amber-400 flex items-center gap-1.5 transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-mono font-extrabold text-[11px] flex items-center justify-center shadow-sm">
                C
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-amber-300 tabular-nums">
                {profile.coins}
              </span>
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('SPIN_WHEEL')}
              aria-label="Free Gems Balance and Spin Wheel"
              className="min-h-[40px] px-2.5 py-1 rounded-xl bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 flex items-center gap-1.5 transition-colors"
            >
              <span className="w-5 h-5 rounded-md rotate-45 bg-emerald-400 text-slate-950 font-mono font-extrabold text-[10px] flex items-center justify-center shadow-sm">
                <span className="-rotate-45">♦</span>
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-emerald-300 tabular-nums">
                {profile.gems}
              </span>
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('SHOP')}
              className="min-h-[40px] px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1 shadow-md transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Shop</span>
            </button>
          </div>

          {/* Right: Messages & Settings Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveModal('MESSAGES')}
              aria-label="Messages and Room Invites"
              className="min-h-[42px] min-w-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-200 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-sky-400" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('SETTINGS')}
              aria-label="Game Settings"
              className="min-h-[42px] min-w-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-200 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. MAIN TAB CONTENT AREA
         ===================================================================== */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-3 pb-6 flex flex-col gap-4">
        {activeTab === 'HOME' && (
          <>
            {/* Quick Floating Actions: Daily Bonus, Spin Wheel & Saved Match Resume */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('DAILY_REWARDS')}
                  className="min-h-[42px] px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 flex items-center gap-2 text-xs font-bold text-amber-300 shadow-md transition-transform active:scale-95"
                >
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Daily Bonus</span>
                  {canClaimDaily && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                      CLAIM
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveModal('SPIN_WHEEL')}
                  className="min-h-[42px] px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 flex items-center gap-2 text-xs font-bold text-purple-300 shadow-md transition-transform active:scale-95"
                >
                  <RefreshCw className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Spin Wheel</span>
                </button>
              </div>

              {savedGameSnapshot && (
                <button
                  type="button"
                  onClick={onResumeSavedGame}
                  className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Saved Match (Turn {savedGameSnapshot.totalTurns})</span>
                </button>
              )}
            </div>

            {/* ===============================================================
                CENTERPIECE: Large Colorful Raheem Ludo Logo & Animated Board
               =============================================================== */}
            <div className="relative rounded-3xl bg-gradient-to-b from-[#172B4D]/90 to-[#0F1C36]/95 border border-slate-700/80 p-4 sm:p-6 shadow-2xl overflow-hidden flex flex-col items-center text-center">
              <div className="w-full max-w-[380px] mx-auto">
                <svg
                  viewBox="0 0 460 215"
                  className="w-full h-auto drop-shadow-2xl"
                  role="img"
                  aria-label="Raheem Ludo Crown Logo and Animated Board Centerpiece"
                >
                  <defs>
                    <linearGradient id="raheemGold" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FEF08A" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>
                  </defs>

                  {/* Royal Crown Crest Above Title */}
                  <g transform="translate(230, 30)">
                    <polygon
                      points="-42,14 -28,-14 -10,4 0,-20 10,4 28,-14 42,14"
                      fill="url(#raheemGold)"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                    <circle cx="-28" cy="-16" r="3.5" fill="#EF4444" />
                    <circle cx="0" cy="-22" r="4.5" fill="#10B981" />
                    <circle cx="28" cy="-16" r="3.5" fill="#3B82F6" />
                  </g>

                  {/* Large Colorful RAHEEM LUDO Title */}
                  <text
                    x="230"
                    y="76"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    stroke="#0F172A"
                    strokeWidth="6"
                    paintOrder="stroke"
                    fontSize="40"
                    fontWeight="900"
                    letterSpacing="1"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    RAHEEM
                  </text>
                  <text
                    x="230"
                    y="114"
                    textAnchor="middle"
                    fill="url(#raheemGold)"
                    stroke="#0F172A"
                    strokeWidth="6"
                    paintOrder="stroke"
                    fontSize="38"
                    fontWeight="900"
                    letterSpacing="4"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    LUDO
                  </text>

                  {/* Animated Isometric-Styled Ludo Board Centerpiece */}
                  <g transform="translate(230, 166)">
                    <ellipse cx="0" cy="18" rx="125" ry="26" fill="#000000" opacity="0.45" />

                    <g transform="scale(1, 0.52) rotate(45)">
                      <rect
                        x="-58"
                        y="-58"
                        width="116"
                        height="116"
                        rx="10"
                        fill="#FFFFFF"
                        stroke="#F59E0B"
                        strokeWidth="5"
                      />
                      <rect x="-53" y="-53" width="42" height="42" rx="4" fill="#EF4444" />
                      <rect x="11" y="-53" width="42" height="42" rx="4" fill="#10B981" />
                      <rect x="11" y="11" width="42" height="42" rx="4" fill="#F59E0B" />
                      <rect x="-53" y="11" width="42" height="42" rx="4" fill="#3B82F6" />

                      <rect x="-45" y="-45" width="26" height="26" rx="3" fill="#FFFFFF" />
                      <rect x="19" y="-45" width="26" height="26" rx="3" fill="#FFFFFF" />
                      <rect x="19" y="19" width="26" height="26" rx="3" fill="#FFFFFF" />
                      <rect x="-45" y="19" width="26" height="26" rx="3" fill="#FFFFFF" />

                      <rect x="-42" y="-7" width="31" height="14" fill="#EF4444" opacity="0.85" />
                      <rect x="-7" y="-42" width="14" height="31" fill="#10B981" opacity="0.85" />
                      <rect x="11" y="-7" width="31" height="14" fill="#F59E0B" opacity="0.85" />
                      <rect x="-7" y="11" width="14" height="31" fill="#3B82F6" opacity="0.85" />

                      <rect x="-11" y="-11" width="22" height="22" fill="#0F172A" stroke="#FDE047" strokeWidth="2" />
                    </g>

                    {/* Animated Hopping 3D Pawns */}
                    <g transform="translate(-48, -6)">
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="-48,-6; -48,-16; -48,-6"
                        dur="1.4s"
                        repeatCount="indefinite"
                      />
                      <circle cx="0" cy="0" r="10" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
                      <circle cx="0" cy="-7" r="6" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
                    </g>

                    <g transform="translate(48, -8)">
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="48,-8; 48,-19; 48,-8"
                        dur="1.6s"
                        begin="0.4s"
                        repeatCount="indefinite"
                      />
                      <circle cx="0" cy="0" r="10" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
                      <circle cx="0" cy="-7" r="6" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
                    </g>

                    <g transform="translate(0, 12)">
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,12; 0,2; 0,12"
                        dur="1.5s"
                        begin="0.8s"
                        repeatCount="indefinite"
                      />
                      <circle cx="0" cy="0" r="10" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2.5" />
                      <circle cx="0" cy="-7" r="6" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2" />
                    </g>
                  </g>
                </svg>
              </div>
            </div>

            {/* ===============================================================
                3. FIVE LARGE GAME MODE CARDS
                   ONLINE · TEAM UP · FRIENDS · COMPUTER · PASS N PLAY
               =============================================================== */}
            <section aria-label="Select Game Mode" className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              {/* Card 1: ONLINE */}
              <button
                type="button"
                onClick={() => setActiveModal('ONLINE_MATCHMAKING')}
                className="col-span-1 sm:col-span-3 group relative rounded-2xl p-4 bg-gradient-to-br from-rose-600 via-red-600 to-red-800 border-2 border-red-400/70 shadow-xl text-left flex flex-col justify-between min-h-[124px] hover:scale-[1.01] active:scale-[0.98] transition-transform cursor-pointer overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/35 text-rose-100">
                    {firebaseConnected
                      ? `${onlinePlayers.length} Online`
                      : 'Sign In to Play'}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="font-display font-extrabold text-lg sm:text-xl text-white tracking-wide">
                    ONLINE
                  </div>
                  <div className="text-xs text-rose-100/90 mt-0.5">
                    Real-time matchmaking with players
                  </div>
                </div>
              </button>

              {/* Card 2: TEAM UP */}
              <button
                type="button"
                onClick={() => setActiveModal('TEAM_UP')}
                className="col-span-1 sm:col-span-3 group relative rounded-2xl p-4 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 border-2 border-emerald-400/70 shadow-xl text-left flex flex-col justify-between min-h-[124px] hover:scale-[1.01] active:scale-[0.98] transition-transform cursor-pointer overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/35 text-emerald-100">
                    2 vs 2 Room
                  </span>
                </div>
                <div className="mt-3">
                  <div className="font-display font-extrabold text-lg sm:text-xl text-white tracking-wide">
                    TEAM UP
                  </div>
                  <div className="text-xs text-emerald-100/90 mt-0.5">
                    Create a team room &amp; invite friends
                  </div>
                </div>
              </button>

              {/* Card 3: FRIENDS */}
              <button
                type="button"
                onClick={() => setActiveModal('FRIENDS_MODAL')}
                className="col-span-1 sm:col-span-2 group relative rounded-2xl p-4 bg-gradient-to-br from-purple-600 via-indigo-600 to-indigo-900 border-2 border-purple-400/70 shadow-xl text-left flex flex-col justify-between min-h-[120px] hover:scale-[1.01] active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/35 text-purple-100">
                    {profile.friends.length} Friends
                  </span>
                </div>
                <div className="mt-2.5">
                  <div className="font-display font-extrabold text-base sm:text-lg text-white tracking-wide">
                    FRIENDS
                  </div>
                  <div className="text-xs text-purple-100/90 mt-0.5">
                    Private rooms &amp; challenges
                  </div>
                </div>
              </button>

              {/* Card 4: COMPUTER */}
              <button
                type="button"
                onClick={() => setActiveModal('COMPUTER_SETUP')}
                className="col-span-1 sm:col-span-2 group relative rounded-2xl p-4 bg-gradient-to-br from-sky-600 via-blue-600 to-blue-900 border-2 border-sky-400/70 shadow-xl text-left flex flex-col justify-between min-h-[120px] hover:scale-[1.01] active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-black/35 text-sky-100">
                    Instant Play
                  </span>
                </div>
                <div className="mt-2.5">
                  <div className="font-display font-extrabold text-base sm:text-lg text-white tracking-wide">
                    COMPUTER
                  </div>
                  <div className="text-xs text-sky-100/90 mt-0.5">
                    Play vs smart AI opponents
                  </div>
                </div>
              </button>

              {/* Card 5: PASS N PLAY */}
              <button
                type="button"
                onClick={() => setActiveModal('PASS_N_PLAY_SETUP')}
                className="col-span-2 sm:col-span-2 group relative rounded-2xl p-4 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 border-2 border-amber-300/80 shadow-xl text-left flex flex-col justify-between min-h-[120px] hover:scale-[1.01] active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-950/20 border border-white/30 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-slate-950/40 text-amber-100">
                    2–4 Players
                  </span>
                </div>
                <div className="mt-2.5">
                  <div className="font-display font-extrabold text-base sm:text-lg text-white tracking-wide">
                    PASS N PLAY
                  </div>
                  <div className="text-xs text-amber-50/95 mt-0.5">
                    2 to 4 people on one device
                  </div>
                </div>
              </button>
            </section>

            {/* ===============================================================
                4. TOURNAMENT SECTION (Upcoming Free Community Tournaments)
               =============================================================== */}
            <section
              aria-label="Upcoming Tournaments"
              className="rounded-2xl bg-gradient-to-r from-slate-900 via-[#16223B] to-slate-900 border border-amber-500/40 p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-base text-white">
                      TOURNAMENT ARENA
                    </span>
                    <span className="text-[11px] font-mono text-amber-300">
                      · Free Entry Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Next Bracket: <strong>Raheem Crown Cup (4-Player)</strong> · Starts at 18:00 · Zero entry fees, pure skill.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal('TOURNAMENT_DETAILS')}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-xs transition-colors shrink-0"
              >
                View Schedule &amp; Practice
              </button>
            </section>
          </>
        )}

        {/* ===================================================================
            TAB 2: EVENT
           =================================================================== */}
        {activeTab === 'EVENT' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-extrabold text-white">
                  Events &amp; Free Tournaments
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  All events in Raheem Ludo are 100% free-to-play with in-game cosmetic rewards only.
                </p>
              </div>
              <Flame className="w-7 h-7 text-amber-400 shrink-0" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {UPCOMING_TOURNAMENTS.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                      <span>{t.schedule}</span>
                      <span>{t.entry}</span>
                    </div>
                    <h3 className="text-base font-display font-bold text-white mt-1">
                      {t.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">{t.format}</p>
                    <p className="text-xs text-emerald-400 mt-2 font-medium">
                      Reward: {t.reward}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartComputerMatch('RED', 4)}
                    className="min-h-[44px] w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                  >
                    Play Warm-Up Practice Match
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-900/90 border border-amber-500/30 p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">7-Day Check-In Bonus</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Current Streak: {profile.dailyStreak} Days
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal('DAILY_REWARDS')}
                  className="min-h-[44px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                >
                  Open Daily Bonus
                </button>
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-purple-500/30 p-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Free Lucky Spin Wheel</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spin for free cosmetic coins &amp; gems
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal('SPIN_WHEEL')}
                  className="min-h-[44px] px-4 rounded-xl bg-purple-500 text-white font-bold text-xs"
                >
                  Open Spin Wheel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: ADDA (Live Rooms & Private Room Codes)
           =================================================================== */}
        {activeTab === 'ADDA' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4">
              <h2 className="text-lg font-display font-extrabold text-white">
                Raheem Ludo Adda &amp; Live Rooms
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Create a live Firestore room code or join an open table.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="text-sm font-bold text-white">Host Private Table Code</div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-mono font-extrabold text-lg text-amber-400 tracking-wider">
                    {teamRoomCode}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCreateLiveFirestoreRoom('FRIENDS_PRIVATE', 4)}
                      className="min-h-[38px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                    >
                      Host in Cloud
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(teamRoomCode).catch(() => {});
                        setCopiedRoomCode(true);
                        setTimeout(() => setCopiedRoomCode(false), 1800);
                      }}
                      className="min-h-[38px] px-3 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1"
                    >
                      {copiedRoomCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRoomCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  {firebaseConnected
                    ? `Signed in · ${liveRooms.length} active room(s) in Firestore`
                    : 'Sign in inside the SOCIAL or ONLINE tab to publish rooms to Firestore.'}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="text-sm font-bold text-white">Join Friend&apos;s Table Code</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={joinRoomInput}
                    onChange={(e) => setJoinRoomInput(e.target.value.toUpperCase())}
                    placeholder="Enter Code (e.g. RL-4829)"
                    maxLength={10}
                    className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveModal('ONLINE_MATCHMAKING')}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: INVENTORY
           =================================================================== */}
        {activeTab === 'INVENTORY' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-extrabold text-white">
                  My Inventory &amp; Customizations
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unlock and equip custom Dice and Token styles using free earned coins and gems.
                </p>
              </div>
              <Layers className="w-6 h-6 text-emerald-400 shrink-0" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SHOP_ITEMS.map((item) => {
                const isUnlocked = profile.unlockedItems.includes(item.id);
                const isEquipped =
                  (item.category === 'DICE' && profile.equippedDiceStyle === item.styleKey) ||
                  (item.category === 'TOKEN' && profile.equippedTokenStyle === item.styleKey);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-mono text-slate-400">{item.category}</div>
                      <div className="text-sm font-bold text-white mt-0.5">{item.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlockOrEquipItem(item)}
                      className={`min-h-[42px] px-3.5 rounded-xl font-bold text-xs shrink-0 transition-colors ${
                        isEquipped
                          ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                          : isUnlocked
                          ? 'bg-slate-800 hover:bg-slate-700 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isEquipped
                        ? 'Equipped ✓'
                        : isUnlocked
                        ? 'Equip'
                        : item.costCoins > 0
                        ? `${item.costCoins} Coins`
                        : `${item.costGems} Gems`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 5: SOCIAL (Firebase Auth, Presence & Official Facebook Login)
           =================================================================== */}
        {activeTab === 'SOCIAL' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-extrabold text-white">
                  Friends, Presence &amp; Cloud Sign-In
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Displays genuine online/offline presence from Firestore (`public_profiles`). Zero fake online players.
                </p>
              </div>
              {firebaseConnected ? (
                <button
                  type="button"
                  onClick={() => signOutFromFirebase()}
                  className="min-h-[42px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusyAuth}
                  onClick={handleGoogleSignIn}
                  className="min-h-[42px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In with Google</span>
                </button>
              )}
            </div>

            {authStatusMsg && (
              <div className="rounded-xl bg-slate-900 border border-amber-500/40 px-4 py-2.5 text-xs text-amber-300">
                {authStatusMsg}
              </div>
            )}

            {/* Official Facebook Login & Friend Permission Card */}
            <div className="rounded-2xl bg-slate-900/90 border border-blue-500/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Official Facebook Login &amp; Friends Sync</span>
                  <span className="text-[11px] font-mono text-amber-300">
                    {profile.fbConnected ? '· Connected' : '· OAuth Ready'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Connects via Firebase <code className="font-mono text-sky-300">FacebookAuthProvider</code>{' '}
                  with <code className="font-mono text-sky-300">user_friends</code> permission when configured in Firebase Console.
                </p>
              </div>
              <button
                type="button"
                disabled={isBusyAuth}
                onClick={handleFacebookSignIn}
                className="min-h-[42px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0"
              >
                {profile.fbConnected ? 'Facebook Linked ✓' : 'Connect Facebook Login'}
              </button>
            </div>

            {/* Live Verified Online Players Directory (from Firestore) */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5">
              <div className="text-xs font-semibold text-emerald-400">
                Verified Online Raheem Ludo Players ({onlinePlayers.length})
              </div>
              {onlinePlayers.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">
                  {firebaseConnected
                    ? 'Only you are currently online in this lobby.'
                    : 'Sign in with Google above to view and broadcast live online presence.'}
                </div>
              ) : (
                onlinePlayers.map((op) => (
                  <div
                    key={op.uid}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLOR_META[op.avatarColor]?.primaryHex || '#10B981' }}
                      />
                      <span className="font-bold text-white">{op.displayName}</span>
                      <span className="font-mono text-slate-400">({op.playerCode})</span>
                    </div>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      ● {op.presenceStatus}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Add In-Game Friend Form */}
            <form
              onSubmit={handleAddFriend}
              className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3"
            >
              <div className="text-sm font-bold text-white">Add Raheem Ludo Friend by ID</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  placeholder="Friend's Name"
                  maxLength={16}
                  className="min-h-[42px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  value={newFriendId}
                  onChange={(e) => setNewFriendId(e.target.value)}
                  placeholder="Player ID (e.g. RL-2049)"
                  maxLength={12}
                  className="min-h-[42px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  + Add to Friends List
                </button>
              </div>
            </form>

            {/* Saved Friends List */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5">
              <div className="text-xs font-semibold text-slate-400">
                In-Game Friends List ({profile.friends.length})
              </div>
              {profile.friends.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  No friends added yet. Add a friend by ID above!
                </div>
              ) : (
                profile.friends.map((friend) => {
                  const isLive = onlinePlayers.some((op) => op.playerCode === friend.id);
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                          {friend.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{friend.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            ID: {friend.id} ·{' '}
                            <span className={isLive ? 'text-emerald-400' : 'text-slate-500'}>
                              {isLive ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveModal('TEAM_UP')}
                        className="min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300"
                      >
                        Invite to Room
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          6. BOTTOM NAVIGATION BAR: HOME · EVENT · ADDA · INVENTORY · SOCIAL
         ===================================================================== */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#080F1E]/95 backdrop-blur-md border-t border-slate-800"
      >
        <div className="max-w-5xl mx-auto grid grid-cols-5 items-center h-16 px-2">
          {(
            [
              { id: 'HOME', label: 'HOME', icon: Compass },
              { id: 'EVENT', label: 'EVENT', icon: Trophy },
              { id: 'ADDA', label: 'ADDA', icon: Crown },
              { id: 'INVENTORY', label: 'INVENTORY', icon: Layers },
              { id: 'SOCIAL', label: 'SOCIAL', icon: Users },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'text-amber-400 font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="text-[10px] tracking-tight mt-1">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* =====================================================================
          MODALS FOR GAME MODES & TOP BAR ACTIONS
         ===================================================================== */}

      {/* MODAL A: COMPUTER MODE SETUP */}
      {activeModal === 'COMPUTER_SETUP' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Play vs Computer
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Choose Your Token Color (Player 1)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PLAYER_ORDER.map((color) => {
                  const meta = COLOR_META[color];
                  const selected = compHumanColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCompHumanColor(color)}
                      className={`min-h-[48px] rounded-xl p-2 flex flex-col items-center justify-center border-2 transition-all ${
                        selected
                          ? 'bg-slate-800 border-white text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-white/80"
                        style={{ backgroundColor: meta.primaryHex }}
                      />
                      <span className="text-[11px] font-bold mt-1">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Match Size
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {([2, 3, 4] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setCompPlayerCount(cnt)}
                    className={`min-h-[44px] rounded-lg text-xs font-bold transition-colors ${
                      compPlayerCount === cnt
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1 Human vs {cnt - 1} {cnt - 1 === 1 ? 'Bot' : 'Bots'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onStartComputerMatch(compHumanColor, compPlayerCount);
              }}
              className="w-full min-h-[50px] rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Computer Match</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL B: PASS N PLAY SETUP */}
      {activeModal === 'PASS_N_PLAY_SETUP' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Pass N Play (2–4 Players)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Number of Players
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {([2, 3, 4] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => onSelectPlayerCount(count)}
                    className={`min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                      setupPlayerCount === count
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {count} Players
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Sequential Turn Order (P1 → P{setupPlayerCount})</span>
                <span>Human / Bot</span>
              </div>
              {setupPlayers
                .filter((p) => p.active)
                .map((player, orderIdx) => {
                  const meta = COLOR_META[player.color];
                  return (
                    <div
                      key={player.color}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950 border border-slate-800"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white shrink-0"
                        style={{ backgroundColor: meta.primaryHex }}
                      >
                        P{orderIdx + 1}
                      </div>
                      <input
                        type="text"
                        value={player.name}
                        maxLength={14}
                        onChange={(e) => onSetupNameChange(player.color, e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-white focus:outline-none px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => onToggleSetupBot(player.color)}
                        className={`min-h-[36px] px-2.5 rounded-lg text-xs font-semibold ${
                          player.isBot
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {player.isBot ? 'Bot' : 'Human'}
                      </button>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onStartPassAndPlayMatch(setupPlayers);
              }}
              className="w-full min-h-[50px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Pass N Play Match</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL C: ONLINE MATCHMAKING (Live Firebase Auth & Firestore Rooms) */}
      {activeModal === 'ONLINE_MATCHMAKING' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-rose-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Online Matchmaking
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Firebase Auth Status:</span>
                <span
                  className={`font-mono font-bold ${
                    firebaseConnected ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {firebaseConnected ? 'Authenticated' : 'Not Signed In'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Verified Online Players:</span>
                <span className="font-mono font-bold text-white">
                  {firebaseConnected ? onlinePlayers.length : 'Sign in to view'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Open Matchmaking Rooms:</span>
                <span className="font-mono font-bold text-amber-300">
                  {firebaseConnected ? liveRooms.length : 'Sign in to view'}
                </span>
              </div>
            </div>

            {authStatusMsg && (
              <div className="text-xs text-amber-300 bg-slate-950 border border-amber-500/30 rounded-xl p-3">
                {authStatusMsg}
              </div>
            )}

            <div className="space-y-2">
              {!firebaseConnected ? (
                <button
                  type="button"
                  disabled={isBusyAuth}
                  onClick={handleGoogleSignIn}
                  className="w-full min-h-[48px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs sm:text-sm transition-colors"
                >
                  Sign In with Google to Enter Live Matchmaking
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCreateLiveFirestoreRoom('ONLINE_2P', 2)}
                  className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm transition-colors"
                >
                  Create Live 2-Player Firestore Room
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  onStartComputerMatch('RED', 2);
                }}
                className="w-full min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
              >
                Play Instant 1v1 vs Computer Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL D: TEAM UP */}
      {activeModal === 'TEAM_UP' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Team Up (2 vs 2 Room)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-950 border border-red-500/40 p-3 space-y-1">
                <div className="font-bold text-amber-300">Team Alpha</div>
                <div className="text-slate-300">P1 (Red) + P3 (Yellow)</div>
              </div>
              <div className="rounded-xl bg-slate-950 border border-emerald-500/40 p-3 space-y-1">
                <div className="font-bold text-emerald-300">Team Bravo</div>
                <div className="text-slate-300">P2 (Green) + P4 (Blue)</div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">Share Room Code with Friends</div>
                <div className="font-mono font-extrabold text-base text-white mt-0.5">
                  {teamRoomCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(teamRoomCode).catch(() => {});
                  setCopiedRoomCode(true);
                  setTimeout(() => setCopiedRoomCode(false), 1800);
                }}
                className="min-h-[40px] px-3 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                {copiedRoomCode ? 'Copied ✓' : 'Copy Invite Code'}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  const teamPlayers: PlayerConfig[] = [
                    { color: 'RED', name: `${profile.displayName} (A1)`, active: true, isBot: false, capturesMade: 0, sixesRolled: 0 },
                    { color: 'GREEN', name: 'Bot Bravo 1 (B1)', active: true, isBot: true, capturesMade: 0, sixesRolled: 0 },
                    { color: 'YELLOW', name: 'Partner Ally (A2)', active: true, isBot: false, capturesMade: 0, sixesRolled: 0 },
                    { color: 'BLUE', name: 'Bot Bravo 2 (B2)', active: true, isBot: true, capturesMade: 0, sixesRolled: 0 },
                  ];
                  onStartTeamUpLocalMatch(teamPlayers);
                }}
                className="w-full min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm"
              >
                Play 2v2 Team Match Now (Local + Bots)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL E: FRIENDS & FACEBOOK LOGIN */}
      {activeModal === 'FRIENDS_MODAL' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Raheem Ludo Friends
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2 text-xs text-slate-300">
              <div className="font-bold text-white flex items-center justify-between">
                <span>Official Facebook Friends</span>
                <button
                  type="button"
                  onClick={handleFacebookSignIn}
                  className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold"
                >
                  {profile.fbConnected ? 'Linked ✓' : 'Facebook Login'}
                </button>
              </div>
              <p>
                Shows Facebook friends only when Meta&apos;s <code className="font-mono text-sky-300">user_friends</code>{' '}
                permission is granted.
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profile.friends.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">
                  Your in-game friends list is currently empty. Add friends in the SOCIAL tab!
                </p>
              ) : (
                profile.friends.map((f) => {
                  const isLive = onlinePlayers.some((op) => op.playerCode === f.id);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{f.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {f.id} · {isLive ? 'ONLINE' : 'OFFLINE'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveModal('PASS_N_PLAY_SETUP')}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold"
                      >
                        Challenge
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onSelectTab('SOCIAL');
              }}
              className="w-full min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
            >
              Open Full Social &amp; Friends Manager
            </button>
          </div>
        </div>
      )}

      {/* MODAL F: DAILY REWARDS */}
      {activeModal === 'DAILY_REWARDS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Daily Check-In Bonus
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Collect free in-game coins and gems each day to unlock custom dice and token designs. (No real-money value.)
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const isClaimed = day <= profile.dailyStreak && !canClaimDaily;
                const isNext = day === (profile.dailyStreak % 7) + 1 && canClaimDaily;
                return (
                  <div
                    key={day}
                    className={`rounded-xl p-2.5 border text-center ${
                      day === 7 ? 'col-span-2' : ''
                    } ${
                      isNext
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : isClaimed
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold">Day {day}</div>
                    <div className="text-xs font-extrabold mt-1">
                      +{50 + day * 15} Coins
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!canClaimDaily}
              onClick={handleClaimDailyReward}
              className={`w-full min-h-[48px] rounded-xl font-display font-extrabold text-sm transition-colors ${
                canClaimDaily
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-400 cursor-default'
              }`}
            >
              {canClaimDaily ? 'Claim Today’s Free Bonus' : 'Claimed for Today ✓'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL G: SPIN WHEEL */}
      {activeModal === 'SPIN_WHEEL' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Free Lucky Spin Wheel
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-52 h-52 mx-auto my-2">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-400 drop-shadow" />
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full rounded-full border-4 border-amber-400 shadow-xl"
                style={{
                  transform: `rotate(${spinRotation}deg)`,
                  transition: isSpinning
                    ? 'transform 2.5s cubic-bezier(0.15, 0.85, 0.25, 1)'
                    : 'none',
                }}
              >
                {SPIN_WHEEL_SLICES.map((slice, i) => {
                  const startAngle = i * 60;
                  return (
                    <g key={slice.id} transform={`rotate(${startAngle} 50 50)`}>
                      <path
                        d="M 50 50 L 50 0 A 50 50 0 0 1 93.3 25 Z"
                        fill={slice.color}
                        stroke="#0F172A"
                        strokeWidth="1"
                      />
                      <text
                        x="64"
                        y="22"
                        fill="#FFFFFF"
                        fontSize="5"
                        fontWeight="800"
                        transform="rotate(30 64 22)"
                        textAnchor="middle"
                      >
                        {slice.label}
                      </text>
                    </g>
                  );
                })}
                <circle cx="50" cy="50" r="9" fill="#0F172A" stroke="#FACC15" strokeWidth="2" />
              </svg>
            </div>

            {lastSpinRewardText && (
              <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl py-2 px-3">
                {lastSpinRewardText}
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Free entertainment bonus only — zero real-money prizes or gambling.
            </p>

            <button
              type="button"
              disabled={isSpinning}
              onClick={handleSpinWheel}
              className="w-full min-h-[48px] rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-display font-extrabold text-sm transition-colors"
            >
              {isSpinning ? 'Spinning Wheel...' : 'Spin Now (Free)'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL H: TOURNAMENT DETAILS */}
      {activeModal === 'TOURNAMENT_DETAILS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Upcoming Tournaments
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {UPCOMING_TOURNAMENTS.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-1 text-xs"
                >
                  <div className="font-bold text-white text-sm">{t.title}</div>
                  <div className="text-amber-300">{t.schedule}</div>
                  <div className="text-slate-400">{t.format}</div>
                  <div className="text-emerald-400 font-semibold pt-1">{t.reward}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                onStartComputerMatch('RED', 4);
              }}
              className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-xs sm:text-sm"
            >
              Launch 4-Player Offline Tournament Practice
            </button>
          </div>
        </div>
      )}

      {/* MODAL I: SHOP */}
      {activeModal === 'SHOP' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Cosmetic Token &amp; Dice Shop
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              All items are unlocked using free earned Coins and Gems. No real-money purchases.
            </p>

            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {SHOP_ITEMS.map((item) => {
                const isUnlocked = profile.unlockedItems.includes(item.id);
                const isEquipped =
                  (item.category === 'DICE' && profile.equippedDiceStyle === item.styleKey) ||
                  (item.category === 'TOKEN' && profile.equippedTokenStyle === item.styleKey);

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlockOrEquipItem(item)}
                      className="min-h-[38px] px-3 rounded-lg bg-amber-500 text-slate-950 font-bold shrink-0"
                    >
                      {isEquipped
                        ? 'Equipped'
                        : isUnlocked
                        ? 'Equip'
                        : item.costCoins > 0
                        ? `${item.costCoins} C`
                        : `${item.costGems} ♦`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL J: MESSAGES */}
      {activeModal === 'MESSAGES' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Messages &amp; Invites
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="font-bold text-white">Welcome to Raheem Ludo!</div>
                <p className="text-slate-300">
                  Play Pass N Play with 2–4 friends on one phone, challenge smart AI in Computer mode, or sign in with Firebase for live online rooms.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL K: SETTINGS */}
      {activeModal === 'SETTINGS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-200" />
                <h2 className="text-lg font-display font-extrabold text-white">
                  Settings &amp; Configuration
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-white">Sound Effects (Web Audio)</span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="min-h-[38px] px-3 rounded-lg bg-slate-800 text-white font-semibold flex items-center gap-1.5"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  <span>{isMuted ? 'Muted' : 'Active'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-white">Classic Ludo Rules</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onOpenRulesModal();
                  }}
                  className="min-h-[38px] px-3 rounded-lg bg-slate-800 text-amber-300 font-semibold"
                >
                  Read Rules
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-white">Account, Cloud Save &amp; Restore</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onOpenLoginScreen();
                  }}
                  className="min-h-[38px] px-3 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Account Screen</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-white">Android APK &amp; AdMob Integration</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    onOpenAndroidModal();
                  }}
                  className="min-h-[38px] px-3 rounded-lg bg-slate-800 text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Open Guide</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL L: PROFILE EDIT */}
      {activeModal === 'PROFILE_EDIT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-display font-extrabold text-white">
                Player Profile &amp; Account
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Player ID</span>
                  <span className="font-mono font-bold text-amber-400">{profile.playerId}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Virtual Coins</span>
                  <span className="font-mono font-bold text-amber-300">
                    {profile.coins.toLocaleString()} C · {profile.gems} ♦
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={tempDisplayName}
                  maxLength={14}
                  onChange={(e) => setTempDisplayName(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Avatar Badge Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_ORDER.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        onUpdateProfile((prev) => ({ ...prev, avatarColor: c }))
                      }
                      className={`h-9 rounded-lg border-2 ${
                        profile.avatarColor === c ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: COLOR_META[c].primaryHex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateProfile((prev) => ({
                    ...prev,
                    displayName: tempDisplayName.trim() || prev.displayName,
                  }));
                  setActiveModal(null);
                }}
                className="w-full min-h-[44px] rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Save Profile Changes
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  onOpenLoginScreen();
                }}
                className="w-full min-h-[42px] rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Save Account / Change Device / Sign In</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
