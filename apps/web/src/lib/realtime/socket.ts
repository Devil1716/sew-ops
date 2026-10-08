"use client";
import { io, Socket } from "socket.io-client";
import { REALTIME_URL } from "@/lib/constants";
import { getAccessToken } from "@/lib/api/client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(REALTIME_URL || "/", {
    autoConnect: true,
    transports: ["websocket"],
    auth: () => ({ token: getAccessToken() }),
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
