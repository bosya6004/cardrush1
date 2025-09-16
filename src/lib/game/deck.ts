import type { BaseCard, PowerCard, UserId } from "./types";

// ===== Constants =====
const COLORS = ["R", "G", "B", "Y"] as const;
const NUMBERS = [0,1,2,3,4,5,6,7,8,9] as const;
const BASE_ACTIONS_COLORED = ["SKIP", "REVERSE", "DRAW2"] as const;

// How many copies of each power card to put in the Power deck (tune as needed)
const POWER_DECK_COPIES = 4;

/**
 * Build the Base deck:
 * - Number cards: 1x zero per color, 2x each 1–9 per color (UNO-like)
 * - Colored actions: 2x SKIP/REVERSE/DRAW2 per color
 * - Wilds: 4x WILD and 4x WILD_DRAW4 (colorless)
 */
export function buildBaseDeck(): BaseCard[] {
  const deck: BaseCard[] = [];

  // Numbers
  for (const c of COLORS) {
    deck.push(`${c}-0` as BaseCard);
    for (const n of NUMBERS.filter(n => n !== 0)) {
      deck.push(`${c}-${n}` as BaseCard);
      deck.push(`${c}-${n}` as BaseCard);
    }
  }

  // Colored actions
  for (const c of COLORS) {
    for (const a of BASE_ACTIONS_COLORED) {
      deck.push(`${c}-${a}` as BaseCard);
      deck.push(`${c}-${a}` as BaseCard);
    }
  }

  // Wilds (colorless)
  for (let i = 0; i < 4; i++) deck.push("WILD");
  for (let i = 0; i < 4; i++) deck.push("WILD_DRAW4");

  return deck;
}

/**
 * Build the Power deck with N copies of each power card.
 * (Adjust POWER_DECK_COPIES to tweak rarity.)
 */
export function buildPowerDeck(copies: number = POWER_DECK_COPIES): PowerCard[] {
  const kinds: PowerCard[] = [
    "POWER_CARD_RUSH",
    "POWER_FREEZE",
    "POWER_COLOR_RUSH",
    "POWER_SWAP_HANDS",
    "POWER_WHIRLWIND",
  ];
  const deck: PowerCard[] = [];
  for (const k of kinds) {
    for (let i = 0; i < copies; i++) deck.push(k);
  }
  return deck;
}

/** Fisher–Yates shuffle (good enough for class prototype). */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal Base cards to each player; returns per-player hands and remaining stack. */
export function dealBaseHands(
  deck: BaseCard[],
  playerIds: UserId[],
  handSize: number = 7
): { hands: Record<UserId, BaseCard[]>; remaining: BaseCard[] } {
  const hands: Record<UserId, BaseCard[]> = {};
  const d = deck.slice();
  for (const pid of playerIds) {
    hands[pid] = d.splice(0, handSize);
  }
  return { hands, remaining: d };
}

/** Draw N cards from the top of a stack (no side effects on the input). */
export function drawFrom<T>(stack: T[], n: number): { drawn: T[]; remaining: T[] } {
  const s = stack.slice();
  const drawn = s.splice(0, n);
  return { drawn, remaining: s };
}

/** Pop a single top card (returns null if stack empty). */
export function popTop<T>(stack: T[]): { top: T; remaining: T[] } | null {
  if (stack.length === 0) return null;
  const s = stack.slice();
  const top = s.shift() as T;
  return { top, remaining: s };
}

/**
 * Flip an initial Discard card for the Base pile.
 * Avoid starting with WILD_DRAW4 (too punishing); if top is WILD_DRAW4, find the next non-WILD_DRAW4.
 * Fallback: if all are WILD_DRAW4 (unlikely), just take the first.
 */
export function flipInitialDiscard(deck: BaseCard[]): { discardTop: BaseCard; remaining: BaseCard[] } {
  const d = deck.slice();
  let idx = d.findIndex(c => c !== "WILD_DRAW4");
  if (idx === -1) idx = 0; // fallback
  const [discardTop] = d.splice(idx, 1);
  return { discardTop, remaining: d };
}
