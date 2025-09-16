// ====== Basic identity ======
export type UserId = string;
export type GameId = string;

// ====== Cards ======
export type Color = "R" | "G" | "B" | "Y";
export type NumberCard = 0|1|2|3|4|5|6|7|8|9;

// Base actions (in the normal Draw Pile)
export type BaseAction = "SKIP" | "REVERSE" | "DRAW2" | "WILD" | "WILD_DRAW4";

// Encoded base cards that can appear in the normal deck
// - Colored number cards: e.g. "R-5"
// - Colored actions: e.g. "G-SKIP", "B-REVERSE", "Y-DRAW2"
// - Colorless wilds: "WILD", "WILD_DRAW4" (set current color when played)
export type BaseCard =
  | `${Color}-${NumberCard}`
  | `${Color}-SKIP`
  | `${Color}-REVERSE`
  | `${Color}-DRAW2`
  | "WILD"
  | "WILD_DRAW4";

// Power cards come from the separate Power Pile
export type PowerCard =
  | "POWER_CARD_RUSH"      // all other players draw 2
  | "POWER_FREEZE"         // target cannot play for next two of their turns
  | "POWER_COLOR_RUSH"     // discard all cards of chosen color
  | "POWER_SWAP_HANDS"     // swap hands with chosen player
  | "POWER_WHIRLWIND";     // redistribute all hands evenly (shuffle + redeal)

// ====== Turn / status ======
export type GameStatus = "active" | "paused" | "finished";

export interface TurnState {
  index: number;     // whose turn (index into players[])
  direction: 1 | -1; // 1 = clockwise, -1 = counterclockwise
}

export interface FreezeState {
  // number of future turns this player is frozen for (not counting forced draws)
  frozenTurnsRemaining: number;
}

// ====== Public game summary (readable by all players) ======
export interface GameSummaryDoc {
  status: GameStatus;

  // fixed seating order; 2–4 players as per functional requirements
  players: UserId[];

  // whose turn & direction
  turn: TurnState;

  // color in play after last Wild/Wild+4 (null until someone sets it)
  currentColor: Color | null;

  // top of Discard Pile (base deck)
  discardTop: { code: BaseCard } | null;

  // OPTIONAL: if you want to surface top of Power Discard too
  powerDiscardTop: { code: PowerCard } | null;

  // counts of remaining draw stacks
  drawCount: number;        // base Draw Pile size
  powerDrawCount: number;   // Power Pile size

  // per-player info
  powerPoints: Record<UserId, number>;       // points toward drawing a Power card
  powerBars: Record<UserId, number>;         // UI meter if you visualize it
  freezes: Record<UserId, FreezeState>;      // active freezes

  // pending draw penalty from stacked DRAW2 / WILD_DRAW4 effects
  pendingDraw: number;                        // number of cards next player must draw

  winner?: UserId | null;
  version: number;            // increments on every committed move
  lastMoveAt?: string;        // ISO timestamp
  createdAt: string;          // ISO timestamp
  createdBy: UserId;
}

// ====== Private per-player hand (visible only to owner) ======
export interface HandDoc {
  cards: BaseCard[];   // power cards are separate, do not count toward hand size
  powerCards?: PowerCard[];   // if you want to hold power cards outside the hand
  updatedAt: string;   // ISO timestamp
}

// ====== Immutable move log ======
export type MoveKind =
  // base-deck actions
  | "PLAY_BASE"
  | "DRAW_BASE"
  | "SET_COLOR"        // result of playing WILD / WILD_DRAW4
  // power-deck actions
  | "DRAW_POWER"
  | "PLAY_POWER";

export interface MoveDoc {
  by: UserId;
  kind: MoveKind;

  // describe what happened
  payload: {
    baseCard?: BaseCard;
    chosenColor?: Color;          // for wild/color-rush
    powerCard?: PowerCard;
    targetUserId?: UserId | null; // for freeze, swap, etc.
    drawAmount?: number;          // for penalties like DRAW2 stacks or Card Rush
  };

  clientMoveId?: string; // idempotency token from client
  at: string;            // ISO timestamp
  versionApplied: number;
}

// ====== Server-only hidden state (not readable by clients) ======
export interface ServerStateDoc {
  // Remaining stacks (top of stack = index 0 or last; you choose consistently)
  baseDeck: BaseCard[];
  powerDeck: PowerCard[];

  // Full discard stacks (top at end) so you can reshuffle when depleted
  baseDiscard: BaseCard[];
  powerDiscard: PowerCard[];

  // For deterministic replays if you seed your RNG
  rngSeed?: string | null;

  // bookkeeping
  lastAppliedVersion: number;
}

// ====== Constants from the spec ======
// Threshold to earn one Power card
export const POWER_CARD_THRESHOLD = 4;

// Points granted by base actions when played (toward earning a Power card)
export const POWER_POINTS: Record<BaseAction, number> = {
  SKIP: 1,
  REVERSE: 1,
  DRAW2: 2,
  WILD: 2,
  WILD_DRAW4: 3,
};
