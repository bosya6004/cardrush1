// src/lib/socket.ts
import { io, Socket } from "socket.io-client";

const isLocal =
  typeof window !== "undefined" && window.location.hostname === "localhost";

const WS_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || (isLocal ? "http://localhost:3001" : "");

if (!isLocal && !WS_URL) {
  throw new Error("Missing NEXT_PUBLIC_SOCKET_URL for production");
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") {
    throw new Error("Socket is client-only");
  }
  if (!socket) {
    // Create but DO NOT auto-connect until we set auth
    socket = io(WS_URL, {
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
