import { adminDb } from "@/lib/firebase/admin";
import {
  GameSummaryDoc,
  HandDoc,
  MoveDoc,
  ServerStateDoc,
  UserId,
  Color,
} from "./types";
import {
  buildBaseDeck,
  buildPowerDeck,
  shuffle,
  dealBaseHands,
  flipInitialDiscard,
} from "./deck";

/** Build initial docs (in memory) for a new game, given player IDs and creator. */
export function buildNewGameDocs(players: UserId[], createdBy: UserId) {
  if (players.length < 2 || players.length > 4) {
    throw new Error("players must be 2–4");
  }

  // 1) Build + shuffle both decks
  const baseDeckShuffled = shuffle(buildBaseDeck());
  const powerDeckShuffled = shuffle(buildPowerDeck());

  // 2) Deal base hands (7 per player)
  const { hands, remaining: baseAfterDeal } = dealBaseHands(
    baseDeckShuffled,
    players,
    7
  );

  // 3) Flip an initial base discard (avoid WILD_DRAW4; see deck.ts)
  const { discardTop, remaining: baseAfterDiscard } = flipInitialDiscard(
    baseAfterDeal
  );

  // 4) Set current color: if the discard is colored, use that color; if wild, require first player to set
  let currentColor: Color | null = null;
  if (discardTop !== "WILD" && discardTop !== "WILD_DRAW4") {
    currentColor = discardTop.split("-")[0] as Color; // "R-5" -> "R"
  }

  const now = new Date().toISOString();

  // 5) Public summary doc
  const summary: GameSummaryDoc = {
    status: "active",
    players,
    turn: { index: 0, direction: 1 },
    currentColor,
    discardTop: { code: discardTop },
    powerDiscardTop: null,
    drawCount: baseAfterDiscard.length,
    powerDrawCount: powerDeckShuffled.length,
    powerPoints: Object.fromEntries(players.map((p) => [p, 0])),
    powerBars: Object.fromEntries(players.map((p) => [p, 0])),
    freezes: Object.fromEntries(
      players.map((p) => [p, { frozenTurnsRemaining: 0 }])
    ),
    pendingDraw: 0,
    winner: null,
    version: 0,
    lastMoveAt: now,
    createdAt: now,
    createdBy,
  };

  // 6) Private hand docs
  const handDocs: Record<UserId, HandDoc> = Object.fromEntries(
    players.map((p) => [
      p,
      {
        cards: hands[p],
        powerCards: [], // start with none; earned via points
        updatedAt: now,
      },
    ])
  );

  // 7) Server-only hidden state
  const serverState: ServerStateDoc = {
    baseDeck: baseAfterDiscard,       // remaining base draw stack
    powerDeck: powerDeckShuffled,     // remaining power draw stack
    baseDiscard: [discardTop],        // history of discards (top at end)
    powerDiscard: [],
    rngSeed: null,
    lastAppliedVersion: 0,
  };

  // 8) Initial move entry (optional but nice for audit)
  const initialMove: MoveDoc = {
    by: createdBy,
    kind: "PLAY_BASE", // conceptually "start"
    payload: { baseCard: discardTop },
    at: now,
    versionApplied: 0,
  };

  return { summary, handDocs, serverState, initialMove };
}

/** Persist a newly built game in one transaction; returns the new gameId. */
export async function createGameTransaction(players: UserId[], createdBy: UserId) {
  const { summary, handDocs, serverState, initialMove } = buildNewGameDocs(
    players,
    createdBy
  );

  const gameRef = adminDb.collection("games").doc(); // auto-id
  await adminDb.runTransaction(async (tx) => {
    tx.set(gameRef, summary);
    tx.set(gameRef.collection("serverState").doc("state"), serverState);
    tx.set(gameRef.collection("moves").doc(), initialMove);

    for (const [uid, hand] of Object.entries(handDocs)) {
      tx.set(gameRef.collection("hands").doc(uid), hand);
    }
  });

  return gameRef.id;
}
