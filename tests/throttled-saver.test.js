import { jest } from '@jest/globals';
import { createThrottledSaver } from '../src/utils/throttledSaver.js';

describe('createThrottledSaver', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces burst triggers into one save', async () => {
    const saveFn = jest.fn(async () => {});
    const saver = createThrottledSaver(saveFn, 1000);

    saver.trigger();
    saver.trigger();
    saver.trigger();

    await jest.advanceTimersByTimeAsync(1000);

    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('flush writes pending update immediately', async () => {
    const saveFn = jest.fn(async () => {});
    const saver = createThrottledSaver(saveFn, 5000);

    saver.trigger();
    await saver.flush();

    expect(saveFn).toHaveBeenCalledTimes(1);
  });
});
