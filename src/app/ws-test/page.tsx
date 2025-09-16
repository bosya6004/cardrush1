"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@clerk/nextjs";

export default function WsTestPage() {
  const { isSignedIn, getToken } = useAuth();
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");
  const [lastPong, setLastPong] = useState<string>("—");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setStatus("idle");
      return;
    }

    let active = true;
    (async () => {
      setStatus("connecting");
      const token = await getToken(); // Clerk session JWT
      if (!active) return;

      const socket: Socket = io("http://localhost:3001", {
        autoConnect: true,
        auth: { clerkToken: token },
      });
      socketRef.current = socket;

      socket.on("connect", () => setStatus("connected"));
      socket.on("disconnect", () => setStatus("disconnected"));
      socket.on("pong", (data) => {
        setLastPong(`pong → ${JSON.stringify(data)}`);
      });
    })();

    return () => {
      active = false;
      const s = socketRef.current;
      if (s) {
        s.off("connect");
        s.off("disconnect");
        s.off("pong");
        s.disconnect();
      }
    };
  }, [isSignedIn, getToken]);

  const sendPing = () => socketRef.current?.emit("ping", { hello: "client" });

  if (!isSignedIn) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">WS Test</h1>
        <p className="mt-2">Sign in to test the authenticated socket.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">WS Test</h1>
      <p className="mt-2">Status: {status}</p>
      <button onClick={sendPing} className="mt-4 rounded border px-3 py-2">
        Send ping
      </button>
      <pre className="mt-4 p-3 border rounded bg-gray-50">{lastPong}</pre>
    </main>
  );
}
