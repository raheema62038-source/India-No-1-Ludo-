import React, { useState } from 'react';
import { Check, Copy, Smartphone, ShieldCheck, Wifi, Sparkles, X } from 'lucide-react';
import { adMobService } from '../services/futureIntegrations';

interface AndroidExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  showAdPreviewBanner: boolean;
  onToggleAdPreviewBanner: () => void;
}

export const AndroidExportModal: React.FC<AndroidExportModalProps> = ({
  isOpen,
  onClose,
  showAdPreviewBanner,
  onToggleAdPreviewBanner,
}) => {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'MULTIPLAYER' | 'CAPACITOR' | 'ADMOB'>('MULTIPLAYER');

  if (!isOpen) return null;

  const adConfig = adMobService.getConfig();

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const capacitorCommands = `# 1. Install Capacitor CLI & Android platform
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Raheem Ludo" com.raheem.ludo --web-dir dist

# 2. Build the production web bundle and sync to Android
npm run build
npx cap add android
npx cap sync android

# 3. Open in Android Studio to build APK or Play Store AAB
npx cap open android`;

  const admobCommands = `# Install official Capacitor AdMob plugin when ready
npm install @capacitor-community/admob
npx cap sync android

# Add your AdMob App ID inside android/app/src/main/AndroidManifest.xml:
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="${adConfig.appIdAndroid}"/>`;

  const firebaseCommands = `# 1. Install Firebase SDK in your project
npm install firebase

# 2. Enable in Firebase Console (console.firebase.google.com):
# - Authentication -> Sign-in method: Enable Google & Facebook providers
# - Firestore Database -> Create database for rooms/{roomId} & users/{uid}
# - Realtime Database -> Enable for /.info/connected presence tracking`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold font-display text-white">
              Online Backend, Facebook &amp; Android Packaging Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Guide"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-5 pt-3 border-b border-slate-800 bg-slate-950/50 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('MULTIPLAYER')}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'MULTIPLAYER'
                ? 'border-blue-400 text-blue-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Online Multiplayer &amp; Facebook Auth
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CAPACITOR')}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'CAPACITOR'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Export Android APK / AAB
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ADMOB')}
            className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ADMOB'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Google AdMob Module
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm leading-relaxed text-slate-300">
          {activeTab === 'MULTIPLAYER' && (
            <>
              <div className="flex items-start gap-3 rounded-xl bg-slate-800/60 border border-slate-700 p-4">
                <Wifi className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <div className="font-semibold text-white">
                    Firebase Authentication, Presence &amp; Matchmaking Architecture
                  </div>
                  <p className="text-xs text-slate-300">
                    All game rules in <code className="text-blue-300 font-mono">src/engine/ludoEngine.ts</code>{' '}
                    are deterministic and emit turn events through{' '}
                    <code className="text-blue-300 font-mono">src/services/futureIntegrations.ts</code>.
                  </p>
                </div>
              </div>

              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleCopy('fb', firebaseCommands)}
                  className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 text-xs font-sans"
                >
                  {copiedBlock === 'fb' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Steps
                    </>
                  )}
                </button>
                <pre className="whitespace-pre-wrap pr-24">{firebaseCommands}</pre>
              </div>

              <ul className="space-y-2 text-xs text-slate-300 list-disc pl-5">
                <li>
                  <strong>Real-Time Matchmaking Rooms (<code className="font-mono">rooms/&#123;roomId&#125;</code>)</strong>:
                  Store <code className="font-mono">hostUid</code>, <code className="font-mono">status</code>,{' '}
                  <code className="font-mono">currentTurnColor</code>, <code className="font-mono">diceValue</code>,
                  and token progress in Firestore so only the active turn&apos;s authenticated UID can submit a
                  move.
                </li>
                <li>
                  <strong>Online / Offline Presence</strong>: Use Firebase Realtime Database&apos;s{' '}
                  <code className="font-mono">/.info/connected</code> with <code className="font-mono">onDisconnect()</code>{' '}
                  to mirror accurate live presence for registered friends without fake counters.
                </li>
                <li>
                  <strong>Official Facebook Login &amp; Friend Invites</strong>: Register a Meta App at{' '}
                  <code className="font-mono">developers.facebook.com</code>, enable Facebook Sign-In in
                  Firebase Auth, and request the <code className="font-mono">user_friends</code> permission to
                  list mutual friends who have installed Raheem Ludo.
                </li>
              </ul>
            </>
          )}

          {activeTab === 'CAPACITOR' && (
            <>
              <p>
                <strong>Raheem Ludo</strong> is engineered as a responsive HTML5/React application with
                procedural Web Audio and vector SVG graphics. Package it into a native Android{' '}
                <code className="text-emerald-300 font-mono">.apk</code> or Google Play{' '}
                <code className="text-emerald-300 font-mono">.aab</code> in 3 steps using{' '}
                <strong>Capacitor</strong>:
              </p>

              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleCopy('cap', capacitorCommands)}
                  className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 text-xs font-sans"
                >
                  {copiedBlock === 'cap' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Commands
                    </>
                  )}
                </button>
                <pre className="whitespace-pre-wrap pr-24">{capacitorCommands}</pre>
              </div>

              <div className="rounded-xl bg-slate-800/60 border border-slate-700/70 p-4 space-y-2">
                <div className="font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  Google Play Store Policy Compliance Built-In
                </div>
                <p className="text-xs text-slate-300">
                  This release contains zero real-money gambling, betting, or paid entry tournaments, making
                  it eligible for standard casual board game rating on Google Play.
                </p>
              </div>
            </>
          )}

          {activeTab === 'ADMOB' && (
            <>
              <p>
                The codebase includes a dedicated service adapter in{' '}
                <code className="text-amber-300 font-mono">src/services/futureIntegrations.ts</code>{' '}
                (<code className="font-mono">adMobService</code>) with hooks for bottom banner ads and
                post-match interstitial ads. No fake advertisements are shown during normal play.
              </p>

              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => handleCopy('admob', admobCommands)}
                  className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 text-xs font-sans"
                >
                  {copiedBlock === 'admob' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Setup
                    </>
                  )}
                </button>
                <pre className="whitespace-pre-wrap pr-24">{admobCommands}</pre>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-800/60 border border-slate-700 p-4">
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Developer AdMob Layout Inspector
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Verify the 50px bottom banner placement height on the match screen.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleAdPreviewBanner}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shrink-0 min-h-[44px] ${
                    showAdPreviewBanner
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {showAdPreviewBanner ? 'Hide Layout Guide' : 'Show Layout Guide'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors min-h-[44px]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
