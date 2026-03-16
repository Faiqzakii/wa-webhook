import { jest } from '@jest/globals';

describe('logger level helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to warn when LOG_LEVEL is missing', async () => {
    delete process.env.LOG_LEVEL;
    const { getConfiguredLogLevel } = await import('../src/utils/logger.js');

    expect(getConfiguredLogLevel()).toBe('WARN');
  });

  it('treats invalid LOG_LEVEL as warn', async () => {
    process.env.LOG_LEVEL = 'verbose';
    const { getConfiguredLogLevel } = await import('../src/utils/logger.js');

    expect(getConfiguredLogLevel()).toBe('WARN');
  });

  it('checks if level is enabled using configured log level', async () => {
    process.env.LOG_LEVEL = 'warn';
    const { isLogLevelEnabled } = await import('../src/utils/logger.js');

    expect(isLogLevelEnabled('ERROR')).toBe(true);
    expect(isLogLevelEnabled('WARN')).toBe(true);
    expect(isLogLevelEnabled('INFO')).toBe(false);
    expect(isLogLevelEnabled('DEBUG')).toBe(false);
  });
});
