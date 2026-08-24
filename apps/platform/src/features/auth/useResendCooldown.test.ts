/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useResendCooldown } from './useResendCooldown';

afterEach(() => {
  vi.useRealTimers();
});

describe('useResendCooldown', () => {
  it('activeOnMount=true → cooldown langsung aktif dan berakhir setelah 60 detik', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useResendCooldown(true));

    expect(result.current.active).toBe(true);
    expect(result.current.remaining).toBe(60);

    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current.active).toBe(false);
    expect(result.current.remaining).toBe(0);
  });

  it('activeOnMount=false → tidak aktif sampai start() dipanggil', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useResendCooldown(false));

    expect(result.current.active).toBe(false);

    act(() => result.current.start());
    expect(result.current.active).toBe(true);

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.active).toBe(false);
  });

  it('start() mereset countdown ke 60 detik lagi', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useResendCooldown(true));

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.remaining).toBe(30);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(60);
  });
});
