import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeferredDelete } from "./use-deferred-delete";

/** V-11: Löschen mit Rückgängig-Fenster – der Timer-Teil, ohne Oberfläche. */
describe("useDeferredDelete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("führt die Löschung erst nach der Verzögerung aus", () => {
    const loeschen = vi.fn();
    const { result } = renderHook(() => useDeferredDelete(loeschen, 5000));

    act(() => result.current.entfernen({ id: "a" }));
    expect(result.current.istEntfernt("a")).toBe(true);
    expect(loeschen).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(4999));
    expect(loeschen).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(loeschen).toHaveBeenCalledExactlyOnceWith("a");
    expect(result.current.istEntfernt("a")).toBe(false);
  });

  it("„Rückgängig“ vor Ablauf verhindert die Löschung ganz", () => {
    const loeschen = vi.fn();
    const { result } = renderHook(() => useDeferredDelete(loeschen, 5000));

    act(() => result.current.entfernen({ id: "a" }));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.zuruecknehmen("a"));

    expect(result.current.istEntfernt("a")).toBe(false);
    act(() => vi.advanceTimersByTime(10_000));
    expect(loeschen).not.toHaveBeenCalled();
  });

  it("hält mehrere schwebende Löschungen auseinander", () => {
    const loeschen = vi.fn();
    const { result } = renderHook(() => useDeferredDelete(loeschen, 5000));

    act(() => result.current.entfernen({ id: "a" }));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.entfernen({ id: "b" }));

    expect(result.current.pending.map((e) => e.id)).toEqual(["a", "b"]);

    act(() => vi.advanceTimersByTime(3000)); // a fällig, b noch nicht
    expect(loeschen.mock.calls).toEqual([["a"]]);
    expect(result.current.pending.map((e) => e.id)).toEqual(["b"]);

    act(() => vi.advanceTimersByTime(2000));
    expect(loeschen.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("führt beim Unmount offene Löschungen sofort aus, statt sie zu verwerfen", () => {
    const loeschen = vi.fn();
    const { result, unmount } = renderHook(() => useDeferredDelete(loeschen, 5000));

    act(() => result.current.entfernen({ id: "a" }));
    act(() => vi.advanceTimersByTime(1000));
    unmount();

    expect(loeschen).toHaveBeenCalledExactlyOnceWith("a");
  });
});
