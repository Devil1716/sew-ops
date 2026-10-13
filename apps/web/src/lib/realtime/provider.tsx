"use client";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { RT } from "@sew-ops/shared";
import { refreshSession } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { disconnectSocket, getSocket } from "@/lib/realtime/socket";
import { useConnectionStore } from "@/stores/connection";

const STAFF_AREA = /^\/(admin|manager)(\/|$)/;
const EV = { ready: "realtime.ready", issueAcknowledged: "issue.acknowledged" } as const;

/**
 * One realtime layer. Events are only hints: they invalidate the matching
 * query roots (batched), and TanStack Query refetches the truth from the API.
 * Connects only for a signed-in manager/admin inside the staff area.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const setStatus = useConnectionStore((s) => s.setStatus);
  const pathname = usePathname();
  const inStaffArea = STAFF_AREA.test(pathname);
  const { data: user } = useSession(inStaffArea);
  const staff = inStaffArea && (user?.role === "admin" || user?.role === "manager");

  useEffect(() => {
    if (!staff) {
      disconnectSocket();
      return;
    }

    const socket = getSocket();
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Set<string>();

    // Batch bursts: ten operators tapping at once cause a few refetches, not dozens.
    const schedule = (...roots: string[]) => {
      roots.forEach((r) => pending.add(r));
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const roots = [...pending];
        pending.clear();
        roots.forEach((r) => void qc.invalidateQueries({ queryKey: [r] }));
      }, 400);
    };

    const onReady = () => {
      failures = 0;
      setStatus("live");
      void qc.invalidateQueries(); // catch up on anything missed while disconnected
    };
    const onDisconnect = (reason: string) => {
      setStatus("reconnecting");
      // The server drops sockets whose session expired: refresh it, then reconnect (bounded).
      if (reason === "io server disconnect") {
        failures += 1;
        if (failures > 3) {
          setStatus("offline");
          return;
        }
        void refreshSession().then((ok) => {
          if (ok) socket.connect();
          else setStatus("offline");
        });
      }
    };
    const onConnectError = () => setStatus("reconnecting");

    const onMachine = () => schedule("machines", "dashboard");
    const onPiece = () => schedule("dashboard", "work-orders");
    const onIssue = () => schedule("issues", "dashboard", "machines");
    const onWorkOrder = () => schedule("work-orders", "dashboard");

    socket.on(EV.ready, onReady);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on(RT.MachineStatusChanged, onMachine);
    socket.on(RT.PieceCompleted, onPiece);
    socket.on(RT.IssueOpened, onIssue);
    socket.on(EV.issueAcknowledged, onIssue);
    socket.on(RT.IssueResolved, onIssue);
    socket.on(RT.WorkOrderUpdated, onWorkOrder);

    return () => {
      if (timer) clearTimeout(timer);
      socket.off(EV.ready, onReady);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off(RT.MachineStatusChanged, onMachine);
      socket.off(RT.PieceCompleted, onPiece);
      socket.off(RT.IssueOpened, onIssue);
      socket.off(EV.issueAcknowledged, onIssue);
      socket.off(RT.IssueResolved, onIssue);
      socket.off(RT.WorkOrderUpdated, onWorkOrder);
    };
  }, [staff, qc, setStatus]);

  return <>{children}</>;
}