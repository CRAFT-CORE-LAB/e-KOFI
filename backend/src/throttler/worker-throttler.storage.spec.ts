import { WorkerThrottlerStorage } from './worker-throttler.storage';

describe('WorkerThrottlerStorage', () => {
  afterEach(() => jest.useRealTimers());

  it('counts hits and blocks once the limit is passed', async () => {
    const storage = new WorkerThrottlerStorage();
    const first = await storage.increment('ip', 60000, 2, 60000, 'default');
    await storage.increment('ip', 60000, 2, 60000, 'default');
    const third = await storage.increment('ip', 60000, 2, 60000, 'default');

    expect(first).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(third).toMatchObject({ totalHits: 3, isBlocked: true });
    expect(third.timeToBlockExpire).toBe(60);
  });

  it('keeps separate counts per key and per throttler', async () => {
    const storage = new WorkerThrottlerStorage();
    await storage.increment('a', 60000, 1, 60000, 'default');
    const otherKey = await storage.increment('b', 60000, 1, 60000, 'default');
    const otherThrottler = await storage.increment('a', 60000, 1, 60000, 'login');

    expect(otherKey).toMatchObject({ totalHits: 1, isBlocked: false });
    expect(otherThrottler).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('lets requests through again after the window and block pass', async () => {
    jest.useFakeTimers();
    const storage = new WorkerThrottlerStorage();
    await storage.increment('ip', 1000, 1, 5000, 'default');
    const blocked = await storage.increment('ip', 1000, 1, 5000, 'default');
    expect(blocked.isBlocked).toBe(true);

    jest.advanceTimersByTime(5001);
    const later = await storage.increment('ip', 1000, 1, 5000, 'default');
    expect(later).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('starts no timers', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    await new WorkerThrottlerStorage().increment('ip', 60000, 5, 60000, 'default');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });
});
