import { AdMobPlacementConfig, MultiplayerRoomInfo, PlayerColor, SavedGameState } from '../types/ludo';

/**
 * ============================================================================
 * 1. GOOGLE ADMOB INTEGRATION LAYER (Android Capacitor Ready)
 * ============================================================================
 * Organized so Google AdMob ads can be activated with zero refactoring of UI
 * or game engine logic when packaging for Android via Capacitor (`@capacitor-community/admob`).
 *
 * Notice: Initial version is 100% free of payments, betting, and real-money gambling.
 */
export class AdMobService {
  private config: AdMobPlacementConfig = {
    appIdAndroid: 'ca-app-pub-3940256099942544~3347511713', // Official Google AdMob Android Sample App ID
    bannerAdUnitId: 'ca-app-pub-3940256099942544/6300978111',
    interstitialAdUnitId: 'ca-app-pub-3940256099942544/1033173712',
    rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
    testMode: true,
  };

  private initialized = false;
  private bannerVisible = false;

  public async initialize(customConfig?: Partial<AdMobPlacementConfig>): Promise<void> {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    // When packaged in Capacitor with @capacitor-community/admob installed:
    // await AdMob.initialize({ initializeForTesting: this.config.testMode });
    this.initialized = true;
  }

  public getConfig(): AdMobPlacementConfig {
    return this.config;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public isBannerActive(): boolean {
    return this.bannerVisible;
  }

  public async showBottomBanner(): Promise<void> {
    this.bannerVisible = true;
    // Capacitor hook:
    // await AdMob.showBanner({ adId: this.config.bannerAdUnitId, position: BannerAdPosition.BOTTOM_CENTER });
  }

  public async hideBottomBanner(): Promise<void> {
    this.bannerVisible = false;
    // Capacitor hook:
    // await AdMob.hideBanner();
  }

  /**
   * Call on natural match boundaries (e.g., after Victory Modal "Play Again" or returning to Home Screen)
   * so ads never interrupt active turns.
   */
  public async triggerMatchEndInterstitial(): Promise<boolean> {
    // Capacitor hook:
    // await AdMob.prepareInterstitial({ adId: this.config.interstitialAdUnitId });
    // await AdMob.showInterstitial();
    return true;
  }
}

/**
 * ============================================================================
 * 2. ONLINE MULTIPLAYER ADAPTER LAYER (WebSocket / Firebase / Supabase Ready)
 * ============================================================================
 * Clean event-driven interface that decouples local pass-and-play turn input
 * from network-synchronized turns.
 */
export type MultiplayerEventHandler = {
  onRoomUpdated?: (room: MultiplayerRoomInfo) => void;
  onRemoteDiceRoll?: (playerColor: PlayerColor, value: number) => void;
  onRemoteTokenMove?: (playerColor: PlayerColor, tokenIndex: number) => void;
  onStateReconcile?: (state: SavedGameState) => void;
};

export class MultiplayerService {
  private currentRoom: MultiplayerRoomInfo | null = null;
  private handlers: MultiplayerEventHandler = {};

  public registerHandlers(handlers: MultiplayerEventHandler): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public getRoom(): MultiplayerRoomInfo | null {
    return this.currentRoom;
  }

  /**
   * Ready to connect to Socket.io, PartyKit, or Firebase Realtime Database / Firestore
   */
  public async createRoom(hostName: string, hostColor: PlayerColor): Promise<MultiplayerRoomInfo> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.currentRoom = {
      roomCode: code,
      hostId: 'local-host',
      status: 'WAITING',
      connectedPlayers: [
        {
          id: 'local-host',
          name: hostName,
          color: hostColor,
          isReady: true,
        },
      ],
    };
    this.handlers.onRoomUpdated?.(this.currentRoom);
    return this.currentRoom;
  }

  public async broadcastDiceRoll(playerColor: PlayerColor, diceValue: number): Promise<void> {
    // Emit 'ludo:dice_roll' to room channel
    void playerColor;
    void diceValue;
  }

  public async broadcastTokenMove(playerColor: PlayerColor, tokenIndex: number): Promise<void> {
    // Emit 'ludo:token_move' to room channel
    void playerColor;
    void tokenIndex;
  }

  public disconnect(): void {
    this.currentRoom = null;
  }
}

export const adMobService = new AdMobService();
export const multiplayerService = new MultiplayerService();
