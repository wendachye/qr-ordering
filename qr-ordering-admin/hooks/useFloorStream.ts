"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, getToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

// Live floor updates over Server-Sent Events. On each "floor" push from the
// server, refetch the floor (and print-health) queries — replacing the old fixed
// 5-second poll with an instant, event-driven refresh. EventSource auto-reconnects
// on network drops; the Tables page keeps a long fallback poll as a safety net.
//
// The token rides in the query string because EventSource can't set an
// Authorization header. We reconnect when the active account changes (login /
// impersonate / exit) so the stream always follows the current store.
export function useFloorStream() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const token = getToken();
    if (!token) return;

    const url = `${API_BASE_URL}/admin/realtime/floor?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    const onFloor = () => {
      qc.invalidateQueries({ queryKey: ["floor"] });
      qc.invalidateQueries({ queryKey: ["print-health"] });
    };
    es.addEventListener("floor", onFloor);

    return () => {
      es.removeEventListener("floor", onFloor);
      es.close();
    };
    // Reconnect on account change; getToken() inside reads the fresh token.
  }, [qc, user?.id, user?.imp]);
}
