"use client";
import { io, Socket } from "socket.io-client";
import { REALTIME_URL } from "@/lib/constants";

let socket: Socket | null = null;

function resolveRealtimeUrl(): string | undefined {
  if (REALTIME_URL) return REALTIME_URL;
  if (typeof window === "undefined") return undefined;
  // Dev talks to the API port directly. Production uses the same origin so the
  // login cookie is sent and Next rewrites /socket.io to the API.
  if (process.env.NODE_ENV === "development") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  return window.location.origin;
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(resolveRealtimeUrl(), {
    // Connect only after the provider has subscribed, or `realtime.ready` is missed
    // and the badge stays on Reconnecting forever.
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true, // the httpOnly login cookie authenticates the socket
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    path: "/socket.io",
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
