"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";              // ← NEW
import { db } from "../../../lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";

type Summary = {
  status: "active" | "paused" | "finished";
  players: string[];
  turn: { index: number; direction: 1 | -1 };
  currentColor: "R" | "G" | "B" | "Y" | null;
  discardTop: { code: string } | null;
  powerDiscardTop?: { code: string } | null;
  drawCount: number;
  powerDrawCount: number;
  pendingDraw: number;
  version: number;
  winner?: string | null;
};

export default function GamePage() {                      // ← no props
  const { isSignedIn, getToken, userId } = useAuth();
  const { gameId } = useParams<{ gameId: string }>();     // ← read from hook
  const socketRef = useRef<Socket | null>(null);

  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [myHandCount, setMyHandCount] = useState<number>(0);
  const [log, setLog] = useState<string>("");
  
  // Join WS room (authoritative, low-latency)
  useEffect(() => {
    if (!isSignedIn) { setStatus("idle"); return; }

    let mounted = true;
    (async () => {
      setStatus("connecting");
      const token = await getToken();
      if (!mounted) return;

      const s = io("http://localhost:3001", { auth: { clerkToken: token } });
      socketRef.current = s;
      (window as Window).__socket = s; // useful for console debugging

      s.on("connect", () => setStatus("connected"));
      s.on("disconnect", () => setStatus("disconnected"));

      s.on("game_state", (payload: { gameId: string; game: Summary }) => {
        if (payload.gameId !== gameId) return;
        setSummary(payload.game);
        setLog((l) => `[ws] v${payload.game.version}\n` + l);
      });

      // join the game room
      s.emit("join_game", { gameId });

    })();

    return () => {
      mounted = false;
      const s = socketRef.current;
      if (s) {
        s.off("connect");
        s.off("disconnect");
        s.off("game_state");
        s.disconnect();
      }
    };
  }, [isSignedIn, getToken, gameId]);

  // Firestore listeners (durability / resync after refresh)
  useEffect(() => {
    if (!userId) return;

    // summary
    const off1 = onSnapshot(doc(db, "games", gameId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Summary;
      setSummary(data);
      setLog((l) => `[fs] v${data.version}\n` + l);
    });

    // my hand (size only for now)
    const off2 = onSnapshot(doc(db, "games", gameId, "hands", userId), (snap) => {
      if (!snap.exists()) { setMyHandCount(0); return; }
      const hand = snap.data() as { cards: string[] };
      setMyHandCount(Array.isArray(hand.cards) ? hand.cards.length : 0);
    });

    return () => { off1(); off2(); };
  }, [gameId, userId]);

  const turnOwner = useMemo(() => {
    if (!summary) return "—";
    const idx = summary.turn.index;
    return summary.players[idx] ?? "—";
  }, [summary]);

  if (!isSignedIn) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Game</h1>
        <p>Sign in to view the game.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Game {gameId}</h1>
      <p>Status: {status}</p>

      {summary ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="border rounded p-3">
            <h2 className="font-semibold">Summary</h2>
            <ul className="list-disc list-inside text-sm">
              <li>players: {summary.players.join(", ")}</li>
              <li>turn → index {summary.turn.index} (dir {summary.turn.direction}) owner {turnOwner}</li>
              <li>currentColor: {summary.currentColor ?? "—"}</li>
              <li>discardTop: {summary.discardTop?.code ?? "—"}</li>
              <li>drawCount: {summary.drawCount} | powerDrawCount: {summary.powerDrawCount}</li>
              <li>pendingDraw: {summary.pendingDraw}</li>
              <li>version: {summary.version}</li>
              <li>winner: {summary.winner ?? "—"}</li>
            </ul>
          </div>

          <div className="border rounded p-3">
            <h2 className="font-semibold">You</h2>
            <p className="text-sm">userId: {userId}</p>
            <p className="text-sm">hand size: {myHandCount}</p>
          </div>
        </div>
      ) : (
        <p>Loading summary…</p>
      )}

      <pre className="border rounded p-3 text-xs whitespace-pre-wrap">{log}</pre>
    </main>
  );
}
