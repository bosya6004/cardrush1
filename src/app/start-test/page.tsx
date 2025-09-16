"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@clerk/nextjs";

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

export default function StartTestPage() {
  const { isSignedIn, getToken, userId } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const [status, setStatus] = useState<"idle"|"connecting"|"connected"|"disconnected">("idle");
  const [otherPlayers, setOtherPlayers] = useState<string>(""); // comma-separated user IDs
  const [gameId, setGameId] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [log, setLog] = useState<string>("");

  // Connect once when signed in
  useEffect(() => {
    if (!isSignedIn) { setStatus("idle"); return; }

    let mounted = true;
    (async () => {
      setStatus("connecting");
      const token = await getToken();
      if (!mounted) return;

      const s = io("http://localhost:3001", { auth: { clerkToken: token } });
      socketRef.current = s;
      (window as Window).__socket = s; // handy for console testing

      s.on("connect", () => setStatus("connected"));
      s.on("disconnect", () => setStatus("disconnected"));

      s.on("game_state", (payload: { gameId: string; game: Summary }) => {
        setGameId(payload.gameId);
        setSummary(payload.game);
        setLog((l) => `[state] v${payload.game.version} turn=${payload.game.turn.index}\n` + l);
      });

      s.on("error_msg", (e: { message: string }) => {
        setLog((l) => `[error] ${e.message}\n` + l);
      });
    })();

    return () => {
      mounted = false;
      const s = socketRef.current;
      if (s) {
        s.off("connect");
        s.off("disconnect");
        s.off("game_state");
        s.off("error_msg");
        s.disconnect();
      }
    };
  }, [isSignedIn, getToken]);

  const startGame = () => {
    const s = socketRef.current;
    if (!s) return;

    // Parse comma-separated IDs; allow starting with just a fake teammate id.
    const extra = otherPlayers
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    // If user didn’t enter anyone, give a dummy teammate to satisfy "2–4 players".
    const players = extra.length ? extra : ["bot_user_1"];
    s.emit("start_game", { players }, (resp: { ok: boolean; gameId?: string; error?: string }) => {
      if (!resp.ok) {
        setLog((l) => `[start_game failed] ${resp.error}\n` + l);
        return;
      }
      setLog((l) => `[start_game ok] gameId=${resp.gameId}\n` + l);
      // The server will emit "game_state" after creation; we also join explicitly to be safe.
      s.emit("join_game", { gameId: resp.gameId! });
    });
  };

  const joinExisting = () => {
    const s = socketRef.current;
    if (!s || !gameId.trim()) return;
    s.emit("join_game", { gameId: gameId.trim() });
    setLog((l) => `[join_game] ${gameId.trim()}\n` + l);
  };

  if (!isSignedIn) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Start Game (Test)</h1>
        <p>Sign in to run the authenticated socket test.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Start Game (Test)</h1>
      <p>Status: {status} | You: {userId}</p>

      <div className="space-y-2">
        <label className="block text-sm">Other player IDs (comma-separated)</label>
        <input
          className="border rounded px-3 py-2 w-full"
          value={otherPlayers}
          onChange={(e) => setOtherPlayers(e.target.value)}
          placeholder="user_abc,user_def (leave empty to use bot_user_1)"
        />
        <button onClick={startGame} className="rounded border px-3 py-2">Start game</button>
      </div>

      <div className="space-y-2">
        <label className="block text-sm">Game ID</label>
        <input
          className="border rounded px-3 py-2 w-full"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          placeholder="paste a gameId to join"
        />
        <button onClick={joinExisting} className="rounded border px-3 py-2">Join existing</button>
      </div>

      {summary && (
        <div className="border rounded p-3">
          <h2 className="font-semibold">Summary</h2>
          <ul className="list-disc list-inside text-sm">
            <li>players: {summary.players.join(", ")}</li>
            <li>turn.index: {summary.turn.index} (dir {summary.turn.direction})</li>
            <li>currentColor: {summary.currentColor ?? "—"}</li>
            <li>discardTop: {summary.discardTop?.code ?? "—"}</li>
            <li>drawCount: {summary.drawCount} | powerDrawCount: {summary.powerDrawCount}</li>
            <li>pendingDraw: {summary.pendingDraw} | version: {summary.version}</li>
            <li>status: {summary.status} | winner: {summary.winner ?? "—"}</li>
          </ul>
        </div>
      )}

      <pre className="border rounded p-3 text-xs whitespace-pre-wrap">{log}</pre>
    </main>
  );
}
