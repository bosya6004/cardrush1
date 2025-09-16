// Load env for this standalone Node process
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { createServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "@clerk/backend";

// ✅ relative imports so tsx can resolve them without path alias setup
import { adminDb } from "./src/lib/firebase/admin";
import { createGameTransaction } from "./src/lib/game/start";

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "http://localhost:3000" } });

// Auth middleware: require a valid Clerk token before joining
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.clerkToken as string | undefined;
    if (!token) return next(new Error("no token"));
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });

    (socket as any).auth = {
      userId: payload.sub,
      sessionId: (payload as any).sid,
    };
    next();
  } catch {
    next(new Error("invalid token"));
  }
});

io.on("connection", (socket) => {
  const auth = (socket as any).auth as { userId: string };
  console.log("client connected", socket.id, "userId:", auth?.userId);

  // --- join a room to receive updates ---
  socket.on("join_game", async ({ gameId }: { gameId: string }) => {
    socket.join(gameId);
    const snap = await adminDb.doc(`games/${gameId}`).get();
    if (snap.exists) {
      socket.emit("game_state", { gameId, game: snap.data() });
    } else {
      socket.emit("error_msg", { message: "game not found" });
    }
  });

  // --- create/start a new game with 2–4 players ---
  socket.on(
    "start_game",
    async (
      payload: { players: string[] },
      ack?: (resp: { ok: boolean; gameId?: string; error?: string }) => void
    ) => {
      try {
        // 1) normalize payload
        const payloadPlayers = (payload?.players || []).map(String).filter(Boolean);

        // 2) include the caller and dedupe
        const players = Array.from(new Set([auth.userId, ...payloadPlayers]));

        // 3) now validate 2–4
        if (players.length < 2 || players.length > 4) {
          throw new Error("players must be 2–4");
        }

        // 4) create, join, and broadcast
        const gameId = await createGameTransaction(players, auth.userId);
        socket.join(gameId);

        const snap = await adminDb.doc(`games/${gameId}`).get();
        const summary = snap.data();

        ack?.({ ok: true, gameId });
        io.to(gameId).emit("game_state", { gameId, game: summary });
      } catch (err: any) {
        const msg = err?.message || "start_game failed";
        ack?.({ ok: false, error: msg });
        socket.emit("error_msg", { message: msg });
      }
    }
  );

  // simple ping/pong
  socket.on("ping", (msg) => {
    socket.emit("pong", { ok: true, echo: msg, at: Date.now(), userId: auth?.userId });
  });

  socket.on("disconnect", (reason) => {
    console.log("client disconnected:", socket.id, reason);
  });
});

// start the server once, outside of the connection handler
httpServer.listen(3001, () => {
  console.log("WS server listening on http://localhost:3001");
});
