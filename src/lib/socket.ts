// src/lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("getSocket must be called in the browser");
  }

  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL; // injected at build time
  const hostname = window.location.hostname;

  // Always prefer the env var when present.
  // Fallbacks:
  // - dev on localhost → http://localhost:3001
  // - prod without env (shouldn't happen) → current origin (just to avoid crashes)
  const url =
    envUrl ||
    (hostname === "localhost" ? "http://localhost:3001" : window.location.origin);

  if (!socket) {
    console.log("[socket] chosen URL:", url, "env:", envUrl, "hostname:", hostname);

    socket = io(url, {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: false,
    });

    socket.on("connect", () => console.log("✅ socket connected:", socket!.id));
    socket.on("disconnect", (reason) => console.log("⚠️ socket disconnected:", reason));
  }

  return socket;
}
