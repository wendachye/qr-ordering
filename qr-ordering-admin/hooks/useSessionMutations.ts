"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ordersApi, sessionsApi } from "@/lib/endpoints";
import { useToast } from "@/components/common/Toast";
import { ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { DiscountType, SessionDetail } from "@/lib/types";

// Session-level mutations for the floor + session-detail pages. Invalidates the
// floor grid, the history list, and the specific session detail so the UI
// reflects close/cancel/reprint immediately (the pages also poll as a backstop).
export function useSessionMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = (sessionId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["floor"] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    if (sessionId) queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  };

  const onError = (err: unknown) =>
    toast(err instanceof ApiError ? err.message : "Action failed.", "error");

  const close = useMutation({
    mutationFn: ({
      id,
      paymentMethod,
      discount,
      voucherCode,
      tip,
    }: {
      id: string;
      paymentMethod: string;
      discount?: { discountType: DiscountType; discountValue: number };
      voucherCode?: string;
      tip?: number;
    }) => sessionsApi.close(id, paymentMethod, discount, voucherCode, tip),
    onSuccess: (s) => {
      invalidate(s.id);
      toast(
        s.paymentMethod ? `Paid by ${s.paymentMethod} — tab settled.` : "Tab settled.",
        "success"
      );
    },
    onError,
  });

  // Record a tender — full or partial/split. A partial tender leaves the tab open
  // with a balance; the final tender closes it.
  const pay = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      paymentMethod: string;
      amount?: number;
      tip?: number;
      tendered?: number;
      discount?: { discountType: DiscountType; discountValue: number };
      voucherCode?: string;
    }) => sessionsApi.pay(id, input),
    onSuccess: (s) => {
      invalidate(s.id);
      if (s.status === "CLOSED") {
        toast(
          s.paymentMethod ? `Paid by ${s.paymentMethod} — tab settled.` : "Tab settled.",
          "success"
        );
      } else {
        toast(`Payment recorded — ${formatPrice(s.balanceDue)} still owing.`, "success");
      }
    },
    onError,
  });

  // Move this tab to another free table.
  const move = useMutation({
    mutationFn: ({ id, targetTableId }: { id: string; targetTableId: string }) =>
      sessionsApi.move(id, targetTableId),
    onSuccess: (s) => {
      queryClient.setQueryData(["session", s.id], s);
      invalidate(s.id);
      toast(`Tab moved to ${s.table.name}.`, "success");
    },
    onError,
  });

  // Combine another open tab into this one.
  const combine = useMutation({
    mutationFn: ({ id, sourceSessionId }: { id: string; sourceSessionId: string }) =>
      sessionsApi.combine(id, sourceSessionId),
    onSuccess: (s, vars) => {
      queryClient.setQueryData(["session", s.id], s);
      invalidate(s.id);
      queryClient.invalidateQueries({ queryKey: ["session", vars.sourceSessionId] });
      toast("Tables combined.", "success");
    },
    onError,
  });

  // Void a single item on an open tab (returns the refreshed session).
  const voidItem = useMutation({
    mutationFn: (vars: { itemId: string; reason?: string; pin?: string }) =>
      ordersApi.voidItem(vars.itemId, vars.reason, vars.pin),
    onSuccess: (s) => {
      queryClient.setQueryData(["session", s.id], s);
      queryClient.invalidateQueries({ queryKey: ["floor"] });
      toast("Item voided.", "success");
    },
    onError,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => sessionsApi.cancel(id),
    onSuccess: (s) => {
      invalidate(s.id);
      toast("Session cancelled.", "success");
    },
    onError,
  });

  // Reprint a single round's kitchen ticket; pass the sessionId so we can refresh
  // that session's print statuses.
  const reprint = useMutation({
    mutationFn: ({ orderId }: { orderId: string; sessionId: string }) =>
      ordersApi.reprint(orderId),
    onSuccess: (_data, { sessionId }) => {
      invalidate(sessionId);
      toast("Kitchen ticket reprint queued.", "success");
    },
    onError,
  });

  const reopen = useMutation({
    mutationFn: (id: string) => sessionsApi.reopen(id),
    onSuccess: (s) => {
      invalidate(s.id);
      toast("Table re-opened — the tab is back on the floor.", "success");
    },
    onError,
  });

  // Pax updates fire on every +/- tap, so update the session cache optimistically
  // (snappy header) and only refresh the floor once settled.
  const setPax = useMutation({
    mutationFn: ({ id, pax }: { id: string; pax: number }) =>
      sessionsApi.setPax(id, pax),
    onMutate: async ({ id, pax }) => {
      await queryClient.cancelQueries({ queryKey: ["session", id] });
      const prev = queryClient.getQueryData<SessionDetail>(["session", id]);
      if (prev) queryClient.setQueryData(["session", id], { ...prev, pax });
      return { prev, id };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["session", ctx.id], ctx.prev);
      onError(err);
    },
    onSuccess: (s) => queryClient.setQueryData(["session", s.id], s),
    onSettled: (s) => {
      queryClient.invalidateQueries({ queryKey: ["floor"] });
      if (s) queryClient.invalidateQueries({ queryKey: ["session", s.id] });
    },
  });

  return { close, pay, cancel, reprint, reopen, setPax, voidItem, move, combine };
}
