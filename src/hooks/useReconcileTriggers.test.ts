import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReconcileTriggers } from "./useReconcileTriggers";

describe("useReconcileTriggers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires reconcile once when userId becomes non-null", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ uid }: { uid: string | null }) =>
        useReconcileTriggers(uid, reconcile, { throttleMs: 1000 }),
      { initialProps: { uid: null as string | null } },
    );
    expect(reconcile).not.toHaveBeenCalled();

    rerender({ uid: "user-1" });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire when the same userId rerenders", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ uid }: { uid: string | null }) =>
        useReconcileTriggers(uid, reconcile, { throttleMs: 1000 }),
      { initialProps: { uid: "user-1" } },
    );
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(reconcile).toHaveBeenCalledTimes(1);

    rerender({ uid: "user-1" });
    rerender({ uid: "user-1" });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("fires again when userId changes (account switch)", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ uid }: { uid: string | null }) =>
        useReconcileTriggers(uid, reconcile, { throttleMs: 1000 }),
      { initialProps: { uid: "user-1" as string | null } },
    );
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    rerender({ uid: "user-2" });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("re-fires on focus when throttle has elapsed", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useReconcileTriggers("user-1", reconcile, { throttleMs: 1000 }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(reconcile).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("throttles focus events within the window", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useReconcileTriggers("user-1", reconcile, { throttleMs: 10_000 }));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(reconcile).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    // Still throttled — only the initial call.
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("does not fire when userId is null", () => {
    const reconcile = vi.fn();
    renderHook(() => useReconcileTriggers(null, reconcile));
    window.dispatchEvent(new Event("focus"));
    expect(reconcile).not.toHaveBeenCalled();
  });
});
