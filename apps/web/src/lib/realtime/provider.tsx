"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { RT, type RealtimePayloadMap } from "@sew-ops/shared";
import { qk } from "@/lib/api/query-keys";
import { getSocket } from "@/lib/realtime/socket";
import { useConnectionStore } from "@/stores/connection";

import { USE_FIXTURES } from "@/lib/constants";

/**
 * One realtime layer. All sockets subscribe here; handlers update the
 * TanStack Query cache directly so components don't need realtime awareness.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const setStatus = useConnectionStore((s) => s.setStatus);

  useEffect(() => {
    if (USE_FIXTURES) {
      setStatus("live");
      return;
    }

    const socket = getSocket();

    const onConnect = () => setStatus("live");
    const onDisconnect = () => setStatus("reconnecting");
    const onReconnectFailed = () => setStatus("offline");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_failed", onReconnectFailed);

    const onMachineStatus = (_p: RealtimePayloadMap[typeof RT.MachineStatusChanged]) => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      qc.invalidateQueries({ queryKey: qk.kpisToday });
    };
    const onPiece = (_p: RealtimePayloadMap[typeof RT.PieceCompleted]) => {
      qc.invalidateQueries({ queryKey: qk.kpisToday });
      qc.invalidateQueries({ queryKey: qk.lineProgress });
      qc.invalidateQueries({ queryKey: ["work-orders"] });
    };
    const onIssueOpened = () => {
      qc.invalidateQueries({ queryKey: ["issues"] });
      qc.invalidateQueries({ queryKey: qk.issuesToday });
      qc.invalidateQueries({ queryKey: qk.notifications });
    };
    const onIssueResolved = () => qc.invalidateQueries({ queryKey: ["issues"] });
    const onWorkOrder = () => qc.invalidateQueries({ queryKey: ["work-orders"] });
    const onNotification = () => qc.invalidateQueries({ queryKey: qk.notifications });

    socket.on(RT.MachineStatusChanged, onMachineStatus);
    socket.on(RT.PieceCompleted, onPiece);
    socket.on(RT.IssueOpened, onIssueOpened);
    socket.on(RT.IssueResolved, onIssueResolved);
    socket.on(RT.WorkOrderUpdated, onWorkOrder);
    socket.on(RT.NotificationCreated, onNotification);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_failed", onReconnectFailed);
      socket.off(RT.MachineStatusChanged, onMachineStatus);
      socket.off(RT.PieceCompleted, onPiece);
      socket.off(RT.IssueOpened, onIssueOpened);
      socket.off(RT.IssueResolved, onIssueResolved);
      socket.off(RT.WorkOrderUpdated, onWorkOrder);
      socket.off(RT.NotificationCreated, onNotification);
    };
  }, [qc, setStatus]);

  return <>{children}</>;
}
