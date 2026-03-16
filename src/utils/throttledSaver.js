export function createThrottledSaver(saveFn, waitMs = 3000) {
    let timeoutId = null;
    let isDirty = false;
    let runningPromise = null;

    const runSave = async () => {
        isDirty = false;
        await saveFn();
    };

    const schedule = () => {
        if (timeoutId) return;

        timeoutId = setTimeout(async () => {
            timeoutId = null;
            try {
                runningPromise = runSave();
                await runningPromise;
            } finally {
                runningPromise = null;
                if (isDirty) {
                    schedule();
                }
            }
        }, waitMs);
    };

    const trigger = () => {
        isDirty = true;
        schedule();
    };

    const flush = async () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        if (runningPromise) {
            await runningPromise;
        }

        if (isDirty) {
            await runSave();
        }
    };

    return { trigger, flush };
}
