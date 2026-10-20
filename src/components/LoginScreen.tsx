import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudUpload,
  Copy,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { COLOR_META } from '../engine/ludoEngine';
import {
  FIREBASE_OAUTH_REDIRECT_URI,
  FIREBASE_PROJECT_ID,
  FirebaseUser,
  signInWithFacebook,
  signInWithGoogle,
  signOutFromFirebase,
  syncOrRestoreUserCloudSave,
} from '../firebase';
import { LocalPlayerProfile } from './LobbyViews';

interface LoginScreenProps {
  profile: LocalPlayerProfile;
  onUpdateProfile: React.Dispatch<React.SetStateAction<LocalPlayerProfile>>;
  firebaseUser: FirebaseUser | null;
  savedMatchTurn: number;
  onContinueToLobby: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

type AuthActionIntent = 'SIGN_IN' | 'LINK_SAVE' | 'RESTORE_ACCOUNT';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  profile,
  onUpdateProfile,
  firebaseUser,
  savedMatchTurn,
  onContinueToLobby,
  isMuted,
  onToggleMute,
}) => {
  const [busyProvider, setBusyProvider] = useState<'FACEBOOK' | 'GOOGLE' | 'SYNC' | null>(null);
  const [activeIntentModal, setActiveIntentModal] = useState<'SAVE_ACCOUNT' | 'RESTORE_DEVICE' | 'OAUTH_SETUP_GUIDE' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState<string | null>(null);

  const isAuthenticated = Boolean(firebaseUser);
  const linkedProviderLabel = firebaseUser?.providerData.some(
    (p) => p.providerId === 'facebook.com'
  )
    ? 'Facebook'
    : firebaseUser?.providerData.some((p) => p.providerId === 'google.com')
    ? 'Google'
    : profile.authProvider || null;

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedUri(key);
    window.setTimeout(() => setCopiedUri(null), 1800);
  };

  /**
   * Executes real OAuth authentication via Firebase Auth (Google or Official Meta OAuth)
   * and synchronizes or restores the player's profile and virtual coin balance in Firestore.
   * Never fakes a login and never collects passwords inside the app.
   */
  const handleProviderAuth = async (
    provider: 'FACEBOOK' | 'GOOGLE',
    intent: AuthActionIntent
  ) => {
    setBusyProvider(provider);
    setErrorMessage(null);
    setErrorCode(null);
    setSuccessMessage(null);

    try {
      const user =
        provider === 'FACEBOOK'
          ? await signInWithFacebook(profile.playerId, profile.avatarColor)
          : await signInWithGoogle(profile.playerId, profile.avatarColor);

      const syncMode = intent === 'RESTORE_ACCOUNT' ? 'RESTORE_ACCOUNT' : 'LINK_SAVE';
      const { saveDoc, existedInCloud } = await syncOrRestoreUserCloudSave(
        user,
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
          savedMatchTurn,
        },
        syncMode
      );

      const restoredItems = saveDoc.unlockedItemsCsv
        ? saveDoc.unlockedItemsCsv.split(',').filter(Boolean)
        : [];

      onUpdateProfile((prev) => ({
        ...prev,
        playerId: saveDoc.playerCode,
        displayName: saveDoc.displayName,
        avatarColor: saveDoc.avatarColor,
        photoUrl: saveDoc.photoUrl || user.photoURL || prev.photoUrl,
        authProvider: saveDoc.authProvider,
        isGuest: false,
        lastCloudSyncAt: Date.now(),
        coins: saveDoc.coins,
        gems: saveDoc.gems,
        dailyStreak: saveDoc.dailyStreak,
        lastDailyClaimDate: saveDoc.lastDailyClaimDate || null,
        equippedDiceStyle: saveDoc.equippedDiceStyle || prev.equippedDiceStyle,
        equippedTokenStyle: saveDoc.equippedTokenStyle || prev.equippedTokenStyle,
        unlockedItems: restoredItems,
        fbConnected: provider === 'FACEBOOK' ? true : prev.fbConnected,
      }));

      setActiveIntentModal(null);

      if (intent === 'RESTORE_ACCOUNT') {
        setSuccessMessage(
          existedInCloud
            ? `Account restored from cloud! Welcome back, ${saveDoc.displayName} (${saveDoc.coins} Coins).`
            : `Signed in as ${saveDoc.displayName}. No previous cloud save was found, so your current progress is now backed up!`
        );
      } else if (intent === 'LINK_SAVE') {
        setSuccessMessage(
          `Guest progress linked and saved to ${
            provider === 'FACEBOOK' ? 'Facebook' : 'Google'
          } Cloud (${saveDoc.coins} Coins preserved)!`
        );
      } else {
        setSuccessMessage(
          `Signed in with ${
            provider === 'FACEBOOK' ? 'Facebook' : 'Google'
          } as ${saveDoc.displayName}!`
        );
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const firebaseCode =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      setErrorCode(firebaseCode || 'AUTH_FAILED');

      if (
        firebaseCode.includes('operation-not-allowed') ||
        rawMessage.includes('operation-not-allowed')
      ) {
        setErrorMessage(
          provider === 'FACEBOOK'
            ? 'Facebook Login is not yet enabled in your Firebase Console. Enable the Facebook provider with your Meta App ID & App Secret in Firebase Authentication.'
            : 'Google Sign-In is not enabled in Firebase Console -> Authentication -> Sign-in method.'
        );
      } else if (
        firebaseCode.includes('popup-closed-by-user') ||
        rawMessage.includes('popup-closed-by-user')
      ) {
        setErrorMessage('Sign-in popup was closed before completing authentication.');
      } else if (
        firebaseCode.includes('popup-blocked') ||
        rawMessage.includes('popup-blocked')
      ) {
        setErrorMessage(
          'Your browser blocked the sign-in popup. Please allow popups for this page and try again.'
        );
      } else {
        setErrorMessage(`Authentication failed: ${rawMessage}`);
      }
    } finally {
      setBusyProvider(null);
    }
  };

  /**
   * Manual Cloud Backup button when already signed in
   */
  const handleManualCloudBackup = async () => {
    if (!firebaseUser) {
      setActiveIntentModal('SAVE_ACCOUNT');
      return;
    }

    setBusyProvider('SYNC');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { saveDoc } = await syncOrRestoreUserCloudSave(
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
          savedMatchTurn,
        },
        'LINK_SAVE'
      );

      onUpdateProfile((prev) => ({
        ...prev,
        coins: saveDoc.coins,
        gems: saveDoc.gems,
        lastCloudSyncAt: Date.now(),
      }));

      setSuccessMessage(
        `Game progress saved to cloud (${saveDoc.coins} Coins, ${saveDoc.gems} Gems)!`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? `Cloud save failed: ${err.message}` : 'Cloud save failed.'
      );
    } finally {
      setBusyProvider(null);
    }
  };

  /**
   * Play as Guest (no account required; plays local games & saves in localStorage)
   */
  const handlePlayAsGuest = () => {
    setErrorMessage(null);
    onUpdateProfile((prev) => ({
      ...prev,
      isGuest: !firebaseUser,
    }));
    onContinueToLobby();
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    await signOutFromFirebase();
    onUpdateProfile((prev) => ({
      ...prev,
      isGuest: true,
      authProvider: undefined,
    }));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#132952] via-[#0B1730] to-[#070E1E] text-slate-100 flex flex-col justify-between p-3 sm:p-6 select-none relative overflow-x-hidden">
      {/* Top Bar: Sound Toggle & Auth Security Guide Button */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-[11px] font-semibold text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Official OAuth · Zero Password Collection</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveIntentModal('OAUTH_SETUP_GUIDE')}
            className="min-h-[38px] px-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>OAuth Setup</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="min-h-[38px] min-w-[38px] rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </header>

      {/* Center Login Card Inspired by Classic Royal Ludo Mobile Login */}
      <main className="w-full max-w-md mx-auto my-auto py-3 flex flex-col items-center gap-4">
        {/* Original Raheem Ludo Royal Crest & 4-Color Emblem */}
        <div className="w-full rounded-3xl bg-gradient-to-b from-[#1B376B]/95 to-[#0E1E3D]/95 border-2 border-amber-400/50 p-4 sm:p-5 shadow-2xl text-center relative overflow-hidden">
          <div className="w-full max-w-[300px] mx-auto">
            <svg
              viewBox="0 0 360 155"
              className="w-full h-auto drop-shadow-xl"
              role="img"
              aria-label="Raheem Ludo Official Emblem"
            >
              <defs>
                <linearGradient id="loginGold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#B45309" />
                </linearGradient>
              </defs>

              {/* Royal Crown */}
              <g transform="translate(180, 26)">
                <polygon
                  points="-36,12 -24,-12 -8,4 0,-18 8,4 24,-12 36,12"
                  fill="url(#loginGold)"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <circle cx="-24" cy="-14" r="3" fill="#EF4444" />
                <circle cx="0" cy="-20" r="4" fill="#10B981" />
                <circle cx="24" cy="-14" r="3" fill="#3B82F6" />
              </g>

              {/* RAHEEM LUDO Title */}
              <text
                x="180"
                y="68"
                textAnchor="middle"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="6"
                paintOrder="stroke"
                fontSize="34"
                fontWeight="900"
                letterSpacing="1.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                RAHEEM
              </text>
              <text
                x="180"
                y="102"
                textAnchor="middle"
                fill="url(#loginGold)"
                stroke="#0F172A"
                strokeWidth="6"
                paintOrder="stroke"
                fontSize="32"
                fontWeight="900"
                letterSpacing="2.5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                LUDO
              </text>

              {/* 4 Ludo Tokens + Center 3D Dice Row */}
              <g transform="translate(94, 128)">
                <circle cx="0" cy="0" r="12" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx="42" cy="0" r="12" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
                <rect
                  x="73"
                  y="-13"
                  width="26"
                  height="26"
                  rx="6"
                  fill="#FFFFFF"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                />
                <circle cx="80" cy="-6" r="2.2" fill="#EF4444" />
                <circle cx="92" cy="-6" r="2.2" fill="#EF4444" />
                <circle cx="86" cy="0" r="2.2" fill="#EF4444" />
                <circle cx="80" cy="6" r="2.2" fill="#EF4444" />
                <circle cx="92" cy="6" r="2.2" fill="#EF4444" />
                <circle cx="130" cy="0" r="12" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2.5" />
                <circle cx="172" cy="0" r="12" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2.5" />
              </g>
            </svg>
          </div>

          {/* =================================================================
              6. PLAYER AVATAR, USERNAME & VIRTUAL COIN BALANCE DISPLAY
             ================================================================= */}
          <div className="mt-2 rounded-2xl bg-slate-950/90 border border-slate-700/90 p-3 flex items-center justify-between gap-2.5 text-left">
            <div className="flex items-center gap-2.5 min-w-0">
              {firebaseUser?.photoURL || profile.photoUrl ? (
                <img
                  src={firebaseUser?.photoURL || profile.photoUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-cover border-2 border-amber-400 shrink-0"
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-extrabold text-base text-white border-2 border-white/60 shrink-0 shadow-inner"
                  style={{ backgroundColor: COLOR_META[profile.avatarColor].primaryHex }}
                >
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-extrabold text-sm text-white truncate">
                    {profile.displayName}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase shrink-0 ${
                      isAuthenticated
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {isAuthenticated ? linkedProviderLabel || 'Verified' : 'Guest'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  ID: {profile.playerId}
                </div>
              </div>
            </div>

            {/* Virtual Coin & Gem Balance */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 font-mono font-extrabold text-[10px] flex items-center justify-center">
                  C
                </span>
                <span className="font-mono font-extrabold text-xs text-amber-300 tabular-nums">
                  {profile.coins.toLocaleString()}
                </span>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 tabular-nums">
                ♦ {profile.gems} Gems
              </div>
            </div>
          </div>
        </div>

        {/* Real Authentication Error Banner (Never Fakes Login) */}
        {errorMessage && (
          <div
            role="alert"
            className="w-full rounded-2xl bg-rose-950/90 border border-rose-500/60 p-3.5 text-xs text-rose-100 space-y-2 shadow-lg"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-rose-200">Authentication Error ({errorCode})</div>
                <p className="text-rose-100/90 mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveIntentModal('OAUTH_SETUP_GUIDE')}
                className="px-2.5 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 border border-rose-400/50 text-[11px] font-bold text-white"
              >
                View Meta &amp; Firebase OAuth Setup Steps
              </button>
            </div>
          </div>
        )}

        {/* Real Authentication / Cloud Sync Success Banner */}
        {successMessage && (
          <div
            role="status"
            className="w-full rounded-2xl bg-emerald-950/90 border border-emerald-500/60 p-3.5 text-xs text-emerald-100 flex items-start gap-2 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 font-semibold leading-relaxed">{successMessage}</div>
          </div>
        )}

        {/* ===================================================================
            PRIMARY LOGIN & ACCOUNT BUTTONS (1 through 5)
           =================================================================== */}
        <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-2xl space-y-3">
          {/* If already authenticated, show Enter Lobby CTA right at top as well */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onContinueToLobby}
              className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Continue to Raheem Ludo Lobby</span>
            </button>
          )}

          {/* 1. CONTINUE WITH FACEBOOK */}
          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => handleProviderAuth('FACEBOOK', 'SIGN_IN')}
            className="w-full min-h-[52px] px-4 rounded-2xl bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-60 text-white font-display font-extrabold text-sm sm:text-base flex items-center justify-between shadow-lg border border-white/15 transition-transform active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-white text-[#1877F2] font-display font-black text-lg flex items-center justify-center shrink-0">
                f
              </span>
              <span>
                {busyProvider === 'FACEBOOK'
                  ? 'Connecting to Meta OAuth...'
                  : 'Continue with Facebook'}
              </span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded-md">
              Friends + Cloud
            </span>
          </button>

          {/* 2. SIGN IN WITH GOOGLE */}
          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={() => handleProviderAuth('GOOGLE', 'SIGN_IN')}
            className="w-full min-h-[52px] px-4 rounded-2xl bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-display font-extrabold text-sm sm:text-base flex items-center justify-between shadow-lg border border-slate-300 transition-transform active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-display font-black text-base flex items-center justify-center shrink-0">
                G
              </span>
              <span>
                {busyProvider === 'GOOGLE'
                  ? 'Connecting to Google Auth...'
                  : 'Sign in with Google'}
              </span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">
              Cloud Save
            </span>
          </button>

          {/* 3. PLAY AS GUEST */}
          <button
            type="button"
            disabled={busyProvider !== null}
            onClick={handlePlayAsGuest}
            className="w-full min-h-[50px] px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-sm sm:text-base flex items-center justify-between shadow-lg transition-transform active:scale-98 cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-xl bg-slate-950/20 text-slate-950 flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 fill-current" />
              </span>
              <span>Play as Guest</span>
            </span>
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider bg-slate-950/20 px-2 py-0.5 rounded-md">
              Local Instant Play
            </span>
          </button>

          {/* 4. SAVE ACCOUNT / SAVE GAME PROGRESS & 5. CHANGE DEVICE / RESTORE ACCOUNT */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={busyProvider !== null}
              onClick={handleManualCloudBackup}
              className="min-h-[48px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-left flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white truncate">
                  Save Account
                </div>
                <div className="text-[10px] text-emerald-300 truncate">
                  {isAuthenticated ? 'Backup Progress' : 'Link Guest Data'}
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={busyProvider !== null}
              onClick={() => setActiveIntentModal('RESTORE_DEVICE')}
              className="min-h-[48px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-sky-500/40 text-left flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white truncate">
                  Change Device
                </div>
                <div className="text-[10px] text-sky-300 truncate">
                  Restore Account
                </div>
              </div>
            </button>
          </div>

          {isAuthenticated && (
            <div className="pt-1 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800">
              <span>
                Signed in via <strong>{linkedProviderLabel}</strong>
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[34px] px-2.5 rounded-lg text-rose-300 hover:bg-rose-500/15 flex items-center gap-1 font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="w-full max-w-md mx-auto text-center text-[11px] text-slate-400 pb-1">
        Raheem Ludo uses official Firebase &amp; Meta OAuth popups. Guest progress is stored locally and can be linked anytime without losing coins or items.
      </footer>

      {/* =====================================================================
          MODAL 1: SAVE ACCOUNT / LINK GUEST PROGRESS
         ===================================================================== */}
      {activeIntentModal === 'SAVE_ACCOUNT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base sm:text-lg font-display font-extrabold text-white">
                  Save Account &amp; Link Guest Progress
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveIntentModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 text-xs text-slate-300 space-y-1.5">
              <div className="font-bold text-white">Current Local Progress to Preserve:</div>
              <div className="flex items-center justify-between font-mono">
                <span>Player Name / ID:</span>
                <span className="text-amber-300">
                  {profile.displayName} ({profile.playerId})
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span>Virtual Coin Balance:</span>
                <span className="text-amber-300">{profile.coins} Coins</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span>Gems &amp; Unlocked Items:</span>
                <span className="text-emerald-300">
                  {profile.gems} Gems · {profile.unlockedItems.length} Cosmetics
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Choose an official account provider below to link your current Guest progress. Your coins, gems, and unlocked items will be merged and backed up to Firestore.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={busyProvider !== null}
                onClick={() => handleProviderAuth('GOOGLE', 'LINK_SAVE')}
                className="w-full min-h-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <span>Link &amp; Save Progress with Google</span>
              </button>

              <button
                type="button"
                disabled={busyProvider !== null}
                onClick={() => handleProviderAuth('FACEBOOK', 'LINK_SAVE')}
                className="w-full min-h-[48px] rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <span>Link &amp; Save Progress with Facebook</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CHANGE DEVICE / RESTORE ACCOUNT
         ===================================================================== */}
      {activeIntentModal === 'RESTORE_DEVICE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-sky-400" />
                <h2 className="text-base sm:text-lg font-display font-extrabold text-white">
                  Change Device / Restore Account
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveIntentModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Playing on a new phone or browser? Sign in with the same <strong>Google</strong> or{' '}
              <strong>Facebook</strong> account you linked previously to restore your saved Raheem Ludo username, Player ID, virtual coin balance, and unlocked cosmetics from Firestore.
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={busyProvider !== null}
                onClick={() => handleProviderAuth('GOOGLE', 'RESTORE_ACCOUNT')}
                className="w-full min-h-[48px] rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <span>Restore Account via Google Sign-In</span>
              </button>

              <button
                type="button"
                disabled={busyProvider !== null}
                onClick={() => handleProviderAuth('FACEBOOK', 'RESTORE_ACCOUNT')}
                className="w-full min-h-[48px] rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-display font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <span>Restore Account via Facebook Login</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: REQUIRED META OAUTH & FIREBASE AUTH SETUP GUIDE
         ===================================================================== */}
      {activeIntentModal === 'OAUTH_SETUP_GUIDE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base sm:text-lg font-display font-extrabold text-white">
                  Authentication &amp; OAuth Configuration
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveIntentModal(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3.5 text-xs text-slate-300 pr-1 leading-relaxed">
              <div className="rounded-2xl bg-emerald-950/50 border border-emerald-500/40 p-3.5 space-y-1">
                <div className="font-bold text-emerald-300">
                  1. Google Sign-In &amp; Cloud Firestore (Active &amp; Ready)
                </div>
                <p>
                  Provisioned on Firebase project <code className="text-white font-mono">{FIREBASE_PROJECT_ID}</code>. Google Sign-In and Firestore cloud saves (<code className="text-white font-mono">/user_saves/&#123;uid&#125;</code>) work out of the box.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5">
                <div className="font-bold text-sky-300">
                  2. Official Meta (Facebook) OAuth Setup Steps
                </div>
                <p>
                  To enable <strong>Continue with Facebook</strong> using the official Meta OAuth flow:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>
                    Go to{' '}
                    <span className="font-mono text-amber-300">
                      https://developers.facebook.com/apps/
                    </span>{' '}
                    and create a Meta App with the <strong>Facebook Login</strong> product.
                  </li>
                  <li>
                    In <strong>Firebase Console → Authentication → Sign-in method</strong> (project{' '}
                    <code className="text-white font-mono">{FIREBASE_PROJECT_ID}</code>), enable{' '}
                    <strong>Facebook</strong> and paste your <strong>Meta App ID</strong> and{' '}
                    <strong>App Secret</strong>.
                  </li>
                  <li>
                    Add this exact <strong>Valid OAuth Redirect URI</strong> inside your Meta App&apos;s Facebook Login Settings:
                  </li>
                </ol>

                <div className="rounded-xl bg-slate-900 border border-slate-700 p-2.5 flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-amber-300 break-all">
                    {FIREBASE_OAUTH_REDIRECT_URI}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(FIREBASE_OAUTH_REDIRECT_URI, 'fb-uri')}
                    className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1 shrink-0"
                  >
                    {copiedUri === 'fb-uri' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveIntentModal(null)}
                className="min-h-[42px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
