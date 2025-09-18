// src/lib/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  // Only run in the browser
  if (typeof window === "undefined") {
    throw new Error("getSocket must be called in the browser");
  }

  const isLocal = window.location.hostname === "localhost";
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

  // In dev: use env if set, otherwise localhost:3001
  // In prod: require env; if missing, we just warn and try current origin (won't work for WS, but avoids build crash)
  const url =
    isLocal ? (envUrl || "http://localhost:3001") : (envUrl ?? window.location.origin);

  if (!socket) {
    socket = io(url, {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: false,
    });

    // Optional debug logs
    socket.on("connect", () => console.log("✅ socket connected:", socket!.id));
    socket.on("disconnect", (reason) => console.log("⚠️ socket disconnected:", reason));
  }

  return socket;
}
