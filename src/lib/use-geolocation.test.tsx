import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGeolocation } from "./use-geolocation";

describe("device location", () => {
  let success: PositionCallback;
  let failure: PositionErrorCallback | null;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn();

  beforeEach(() => {
    watchPosition.mockImplementation((ok, fail) => {
      success = ok;
      failure = fail;
      return 42;
    });
    vi.stubGlobal("navigator", { geolocation: { watchPosition, clearWatch } });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const position = (accuracy: number): GeolocationPosition => ({
    coords: {
      latitude: -26.2041,
      longitude: 28.0473,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  });

  it("uses approximate device coordinates instead of leaving the default pin", () => {
    const onPosition = vi.fn();
    const { result, unmount } = renderHook(() => useGeolocation(onPosition));
    act(() => success(position(1500)));
    expect(onPosition).toHaveBeenCalledWith({ lat: -26.2041, lng: 28.0473 });
    expect(result.current.status).toBe("approximate");
    act(() => success(position(20)));
    expect(result.current.status).toBe("ready");
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it("keeps a received location when a later GPS request times out", () => {
    const { result } = renderHook(() => useGeolocation(vi.fn()));
    act(() => success(position(20)));
    act(() =>
      failure?.({
        code: 3,
        message: "Timeout",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }),
    );
    expect(result.current.status).toBe("ready");
  });

  it("shows blocked permissions and retries with a new watch", () => {
    const { result } = renderHook(() => useGeolocation(vi.fn()));
    act(() =>
      failure?.({
        code: 1,
        message: "Denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }),
    );
    expect(result.current.status).toBe("denied");
    act(() => result.current.locate());
    expect(clearWatch).toHaveBeenCalledWith(42);
    expect(watchPosition).toHaveBeenCalledTimes(2);
    act(() => success(position(20)));
    expect(result.current.status).toBe("ready");
  });
});
