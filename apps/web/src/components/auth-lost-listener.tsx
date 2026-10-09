"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AUTH_LOST_EVENT } from "@/lib/api/client";
import { areaOf, loginPathFor } from "@/lib/auth/session";

/** When a session cannot be restored, leave the protected area once. */
export function AuthLostListener() {
  const qc = useQueryClient();

  useEffect(() => {
    let handled = false;
    const onLost = () => {
      const path = window.location.pathname;
      if (handled || !areaOf(path)) return;
      handled = true;
      qc.clear();
      window.location.assign(loginPathFor(path));
    };
    window.addEventListener(AUTH_LOST_EVENT, onLost);
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost);
  }, [qc]);

  return null;
}