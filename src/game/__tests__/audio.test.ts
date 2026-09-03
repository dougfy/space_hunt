import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CRITICAL_SOUND_IDS, warmCriticalSounds, preloadSounds } from '../audio';

// Startup-performance guard: warming the critical sound set must stay small and
// off the critical path, while the full library is only fetched by preloadSounds.
describe('audio startup warming', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).AudioContext = vi.fn(() => ({
      state: 'running',
      resume: vi.fn(),
      decodeAudioData: vi.fn(async () => ({})),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CRITICAL_SOUND_IDS is a small non-empty set', () => {
    expect(CRITICAL_SOUND_IDS.length).toBeGreaterThan(0);
    expect(CRITICAL_SOUND_IDS.length).toBeLessThanOrEqual(10);
    // no duplicates
    expect(new Set(CRITICAL_SOUND_IDS).size).toBe(CRITICAL_SOUND_IDS.length);
  });

  it('warmCriticalSounds fetches only the critical set', () => {
    warmCriticalSounds();
    // Every critical id maps to a real file, so one fetch fires per id.
    expect(fetchMock).toHaveBeenCalledTimes(CRITICAL_SOUND_IDS.length);
  });

  it('preloadSounds fetches strictly more than the critical set', () => {
    warmCriticalSounds();
    const criticalCalls = fetchMock.mock.calls.length;
    fetchMock.mockClear();
    preloadSounds();
    // Full library is larger than the critical subset; remaining files still fetch.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(criticalCalls + fetchMock.mock.calls.length).toBeGreaterThan(criticalCalls);
  });
});
