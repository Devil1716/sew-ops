"use client";
import { io, Socket } from "socket.io-client";
import { REALTIME_URL } from "@/lib/constants";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const realtimeUrl =
    REALTIME_URL ||
    (process.env.NODE_ENV === "development" && typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : "/");
  socket = io(realtimeUrl, {
    autoConnect: true,
    transports: ["websocket"],
    withCredentials: true, // the httpOnly login cookie authenticates the socket
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
