import { initializeApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PlayerColor } from './types/ludo';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_DOMAIN = firebaseConfig.authDomain;
export const FIREBASE_OAUTH_REDIRECT_URI = `https://${firebaseConfig.authDomain}/__/auth/handler`;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Serializes Firestore read-then-write operations so concurrent calls on sign-in
 * never race on `getDoc` -> `setDoc` vs `updateDoc` (which would violate immutable `createdAt`).
 */
let firestoreWriteQueue: Promise<unknown> = Promise.resolve();

function enqueueFirestoreWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = firestoreWriteQueue.then(task, task);
  firestoreWriteQueue = next.catch(() => {});
  return next;
}

/**
 * Validate connection to Firestore on boot as required by Firebase skill.
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface OnlinePlayerDoc {
  uid: string;
  playerCode: string;
  displayName: string;
  avatarColor: PlayerColor;
  presenceStatus: 'ONLINE' | 'IN_MATCH' | 'OFFLINE';
  friendUids?: string;
}

export interface UserCloudSaveDoc {
  uid: string;
  playerCode: string;
  displayName: string;
  avatarColor: PlayerColor;
  photoUrl: string;
  authProvider: 'GOOGLE' | 'FACEBOOK';
  coins: number;
  gems: number;
  dailyStreak: number;
  lastDailyClaimDate: string;
  equippedDiceStyle: string;
  equippedTokenStyle: string;
  unlockedItemsCsv: string;
  savedMatchTurn: number;
}

export interface LiveRoomDoc {
  roomCode: string;
  hostUid: string;
  hostName: string;
  mode: 'ONLINE_2P' | 'ONLINE_4P' | 'TEAM_UP_2V2' | 'FRIENDS_PRIVATE';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  maxPlayers: number;
  currentTurnColor: PlayerColor;
  diceValue?: number;
  connectedCount?: number;
}

/**
 * Sign in with Google Popup via Firebase Authentication.
 */
export async function signInWithGoogle(
  playerCode: string,
  avatarColor: PlayerColor
): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  await upsertPublicProfile(cred.user, playerCode, avatarColor, 'ONLINE');
  return cred.user;
}

/**
 * Sign in with Official Facebook OAuth Popup via Firebase Authentication.
 * Never collects passwords inside the app; delegates strictly to Meta OAuth dialog.
 */
export async function signInWithFacebook(
  playerCode: string,
  avatarColor: PlayerColor
): Promise<FirebaseUser> {
  const provider = new FacebookAuthProvider();
  provider.addScope('public_profile');
  provider.addScope('user_friends');
  const cred = await signInWithPopup(auth, provider);
  await upsertPublicProfile(cred.user, playerCode, avatarColor, 'ONLINE');
  return cred.user;
}

export async function signOutFromFirebase(): Promise<void> {
  if (auth.currentUser) {
    const uid = auth.currentUser.uid;
    try {
      await enqueueFirestoreWrite(async () => {
        await updateDoc(doc(db, 'public_profiles', uid), {
          presenceStatus: 'OFFLINE',
          updatedAt: serverTimestamp(),
        });
      });
    } catch {
      // ignore if doc wasn't created yet
    }
  }
  await signOut(auth);
}

/**
 * Fetch the authenticated user's cloud save document from `/user_saves/{uid}`.
 */
export async function fetchUserCloudSave(uid: string): Promise<UserCloudSaveDoc | null> {
  const path = `user_saves/${uid}`;
  const ref = doc(db, 'user_saves', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as UserCloudSaveDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Creates or updates the authenticated player's non-PII public profile & presence in Firestore.
 * Serialized via `enqueueFirestoreWrite` to guarantee no concurrent create/update race.
 */
export async function upsertPublicProfile(
  user: FirebaseUser,
  playerCode: string,
  avatarColor: PlayerColor,
  presenceStatus: 'ONLINE' | 'IN_MATCH' | 'OFFLINE',
  overrideDisplayName?: string
): Promise<void> {
  return enqueueFirestoreWrite(async () => {
    const path = `public_profiles/${user.uid}`;
    const ref = doc(db, 'public_profiles', user.uid);
    const cleanName =
      (overrideDisplayName || user.displayName || 'Player').trim().slice(0, 32) || 'Player';
    const cleanCode =
      playerCode.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) || 'RL-1000';
    const validColor: PlayerColor = ['RED', 'GREEN', 'YELLOW', 'BLUE'].includes(avatarColor)
      ? avatarColor
      : 'BLUE';

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: user.uid,
          playerCode: cleanCode,
          displayName: cleanName,
          avatarColor: validColor,
          presenceStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          playerCode: cleanCode,
          displayName: cleanName,
          avatarColor: validColor,
          presenceStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  });
}

/**
 * Links/merges local guest progress into `/user_saves/{uid}` or restores an existing
 * cloud account onto a new device without losing coins, gems, or unlocked items.
 */
export async function syncOrRestoreUserCloudSave(
  user: FirebaseUser,
  localState: {
    playerCode: string;
    displayName: string;
    avatarColor: PlayerColor;
    coins: number;
    gems: number;
    dailyStreak: number;
    lastDailyClaimDate: string | null;
    equippedDiceStyle: string;
    equippedTokenStyle: string;
    unlockedItems: string[];
    savedMatchTurn: number;
  },
  mode: 'LINK_SAVE' | 'RESTORE_ACCOUNT'
): Promise<{ saveDoc: UserCloudSaveDoc; existedInCloud: boolean }> {
  const result = await enqueueFirestoreWrite(async () => {
    const path = `user_saves/${user.uid}`;
    const ref = doc(db, 'user_saves', user.uid);

    const isFacebook = user.providerData.some((p) => p.providerId === 'facebook.com');
    const authProvider: 'GOOGLE' | 'FACEBOOK' = isFacebook ? 'FACEBOOK' : 'GOOGLE';
    const cleanPhotoUrl = (user.photoURL || '').slice(0, 500);

    try {
      const existingSnap = await getDoc(ref);
      const existedInCloud = existingSnap.exists();

      if (existedInCloud) {
        const cloud = existingSnap.data() as UserCloudSaveDoc;

        const cloudItems = cloud.unlockedItemsCsv
          ? cloud.unlockedItemsCsv.split(',').filter(Boolean)
          : [];
        const mergedItems = Array.from(new Set([...cloudItems, ...localState.unlockedItems]));
        const unlockedItemsCsv = mergedItems.join(',').slice(0, 500);

        const mergedName =
          (mode === 'RESTORE_ACCOUNT'
            ? cloud.displayName || user.displayName || localState.displayName
            : localState.displayName !== 'Player 1' && !localState.displayName.startsWith('Guest')
            ? localState.displayName
            : cloud.displayName || user.displayName || localState.displayName
          )
            .trim()
            .slice(0, 32) || 'Player 1';

        const mergedCode =
          (cloud.playerCode || localState.playerCode)
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, '')
            .slice(0, 16) || 'RL-1000';

        const rawAvatarColor =
          mode === 'RESTORE_ACCOUNT' ? cloud.avatarColor : localState.avatarColor;
        const mergedAvatarColor: PlayerColor = ['RED', 'GREEN', 'YELLOW', 'BLUE'].includes(
          rawAvatarColor
        )
          ? rawAvatarColor
          : 'BLUE';

        const mergedCoins = Math.min(
          10000000,
          Math.max(0, Math.floor(Math.max(cloud.coins || 0, localState.coins || 0)))
        );
        const mergedGems = Math.min(
          1000000,
          Math.max(0, Math.floor(Math.max(cloud.gems || 0, localState.gems || 0)))
        );
        const mergedStreak = Math.min(
          365,
          Math.max(0, Math.floor(Math.max(cloud.dailyStreak || 0, localState.dailyStreak || 0)))
        );
        const mergedClaimDate = (
          cloud.lastDailyClaimDate ||
          localState.lastDailyClaimDate ||
          ''
        ).slice(0, 16);
        const mergedDice = (
          mode === 'RESTORE_ACCOUNT'
            ? cloud.equippedDiceStyle
            : localState.equippedDiceStyle || cloud.equippedDiceStyle || 'CLASSIC'
        ).slice(0, 32);
        const mergedToken = (
          mode === 'RESTORE_ACCOUNT'
            ? cloud.equippedTokenStyle
            : localState.equippedTokenStyle || cloud.equippedTokenStyle || 'CROWN'
        ).slice(0, 32);
        const mergedMatchTurn = Math.min(
          10000,
          Math.max(0, Math.floor(localState.savedMatchTurn || cloud.savedMatchTurn || 0))
        );

        await updateDoc(ref, {
          playerCode: mergedCode,
          displayName: mergedName,
          avatarColor: mergedAvatarColor,
          photoUrl: (cleanPhotoUrl || cloud.photoUrl || '').slice(0, 500),
          authProvider,
          coins: mergedCoins,
          gems: mergedGems,
          dailyStreak: mergedStreak,
          lastDailyClaimDate: mergedClaimDate,
          equippedDiceStyle: mergedDice,
          equippedTokenStyle: mergedToken,
          unlockedItemsCsv,
          savedMatchTurn: mergedMatchTurn,
          updatedAt: serverTimestamp(),
        });

        return {
          existedInCloud: true,
          saveDoc: {
            uid: user.uid,
            playerCode: mergedCode,
            displayName: mergedName,
            avatarColor: mergedAvatarColor,
            photoUrl: (cleanPhotoUrl || cloud.photoUrl || '').slice(0, 500),
            authProvider,
            coins: mergedCoins,
            gems: mergedGems,
            dailyStreak: mergedStreak,
            lastDailyClaimDate: mergedClaimDate,
            equippedDiceStyle: mergedDice,
            equippedTokenStyle: mergedToken,
            unlockedItemsCsv,
            savedMatchTurn: mergedMatchTurn,
          },
        };
      } else {
        const cleanCode =
          localState.playerCode.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) ||
          'RL-1000';
        const cleanName =
          (
            user.displayName ||
            (localState.displayName !== 'Player 1' ? localState.displayName : 'Player 1')
          )
            .trim()
            .slice(0, 32) || 'Player 1';
        const validColor: PlayerColor = ['RED', 'GREEN', 'YELLOW', 'BLUE'].includes(
          localState.avatarColor
        )
          ? localState.avatarColor
          : 'BLUE';
        const unlockedItemsCsv = localState.unlockedItems.join(',').slice(0, 500);
        const safeCoins = Math.min(10000000, Math.max(0, Math.floor(localState.coins || 0)));
        const safeGems = Math.min(1000000, Math.max(0, Math.floor(localState.gems || 0)));
        const safeStreak = Math.min(
          365,
          Math.max(0, Math.floor(localState.dailyStreak || 0))
        );
        const safeClaimDate = (localState.lastDailyClaimDate || '').slice(0, 16);
        const safeDice = (localState.equippedDiceStyle || 'CLASSIC').slice(0, 32);
        const safeToken = (localState.equippedTokenStyle || 'CROWN').slice(0, 32);
        const safeTurn = Math.min(
          10000,
          Math.max(0, Math.floor(localState.savedMatchTurn || 0))
        );

        await setDoc(ref, {
          uid: user.uid,
          playerCode: cleanCode,
          displayName: cleanName,
          avatarColor: validColor,
          photoUrl: cleanPhotoUrl,
          authProvider,
          coins: safeCoins,
          gems: safeGems,
          dailyStreak: safeStreak,
          lastDailyClaimDate: safeClaimDate,
          equippedDiceStyle: safeDice,
          equippedTokenStyle: safeToken,
          unlockedItemsCsv,
          savedMatchTurn: safeTurn,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return {
          existedInCloud: false,
          saveDoc: {
            uid: user.uid,
            playerCode: cleanCode,
            displayName: cleanName,
            avatarColor: validColor,
            photoUrl: cleanPhotoUrl,
            authProvider,
            coins: safeCoins,
            gems: safeGems,
            dailyStreak: safeStreak,
            lastDailyClaimDate: safeClaimDate,
            equippedDiceStyle: safeDice,
            equippedTokenStyle: safeToken,
            unlockedItemsCsv,
            savedMatchTurn: safeTurn,
          },
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  });

  await upsertPublicProfile(
    user,
    result.saveDoc.playerCode,
    result.saveDoc.avatarColor,
    'ONLINE',
    result.saveDoc.displayName
  );

  return result;
}

/**
 * Create a real-time room in Firestore (/rooms/{roomCode})
 */
export async function createLiveRoomInFirestore(
  roomCode: string,
  mode: LiveRoomDoc['mode'],
  maxPlayers: 2 | 4
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to create a live room.');

  const cleanRoomCode = roomCode.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  const path = `rooms/${cleanRoomCode}`;
  const ref = doc(db, 'rooms', cleanRoomCode);

  return enqueueFirestoreWrite(async () => {
    try {
      await setDoc(ref, {
        roomCode: cleanRoomCode,
        hostUid: user.uid,
        hostName: (user.displayName || 'Player').slice(0, 32),
        mode,
        status: 'WAITING',
        maxPlayers,
        currentTurnColor: 'BLUE',
        diceValue: 6,
        connectedCount: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return cleanRoomCode;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  });
}

/**
 * Subscribe to genuinely online players and open waiting rooms in Firestore.
 * Only attaches listeners when the user is signed in.
 */
export function subscribeToOnlinePresenceAndRooms(
  onPlayersChange: (players: OnlinePlayerDoc[]) => void,
  onRoomsChange: (rooms: LiveRoomDoc[]) => void
): () => void {
  const profilesQuery = query(
    collection(db, 'public_profiles'),
    where('presenceStatus', 'in', ['ONLINE', 'IN_MATCH']),
    limit(25)
  );

  const roomsQuery = query(
    collection(db, 'rooms'),
    where('status', 'in', ['WAITING', 'PLAYING']),
    limit(20)
  );

  const unsubProfiles = onSnapshot(
    profilesQuery,
    (snap) => {
      const list: OnlinePlayerDoc[] = [];
      snap.forEach((d) => list.push(d.data() as OnlinePlayerDoc));
      onPlayersChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'public_profiles');
    }
  );

  const unsubRooms = onSnapshot(
    roomsQuery,
    (snap) => {
      const list: LiveRoomDoc[] = [];
      snap.forEach((d) => list.push(d.data() as LiveRoomDoc));
      onRoomsChange(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    }
  );

  return () => {
    unsubProfiles();
    unsubRooms();
  };
}

export { onAuthStateChanged };
export type { FirebaseUser };
