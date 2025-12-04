import cron from 'node-cron';
import { runTrainingCycle } from './worker/trainer';

cron.schedule('0 4 * * *', async () => {
    console.log("[CRON] Starting daily ML training cycle...");
    await runTrainingCycle();
});

// manual run
if (require.main === module) {
    (async () => {
        console.log("[CRON] Manual trigger.");
        await runTrainingCycle();
        console.log("[CRON] Completed.");
        process.exit(0);
    })();
}
