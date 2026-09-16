import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately, with no delay on first render", () => {
    const { result } = renderHook(() => useDebouncedValue("al", 300));
    expect(result.current).toBe("al");
  });

  it("does not update before the delay elapses", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "ab" });
    act(() => vi.advanceTimersByTime(299));

    expect(result.current).toBe("a");
  });

  it("updates to the latest value once the delay elapses", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "ab" });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe("ab");
  });

  it("collapses several rapid changes into a single final update (resets the timer each time)", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, rerender } = renderHook(({ v }: { v: string }) => useDebouncedValue(v, 300), {
      initialProps: { v: "a" },
    });

    rerender({ v: "al" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: "ale" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: "alex" });

    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("alex");
  });
});
