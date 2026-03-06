import { getServiceSupabase } from '@/lib/server/supabase';
import { syncWorkerTick } from '@/lib/server/sync-engine';
import { Context } from '@netlify/functions';

export default async (req: Request, context: Context) => {
  console.log('[Background Sync] Starting background sync process');

  try {
    const supabase = await getServiceSupabase();
    const start = Date.now();
    // Run for up to 14 minutes (Netlify limit is 15m)
    const MAX_RUNTIME = 14 * 60 * 1000;
    
    let iterations = 0;
    let totalProcessed = 0;

    while (Date.now() - start < MAX_RUNTIME) {
      console.log(`[Background Sync] Iteration ${iterations + 1}`);
      const { processed } = await syncWorkerTick(50, supabase);
      
      totalProcessed += processed;
      iterations++;

      if (processed === 0) {
        console.log('[Background Sync] No work found, waiting 10s...');
        // If no work, wait a bit to avoid spinning too fast, but keep checking
        // or just exit if we assume work is queued?
        // Better to wait and check again a few times, then maybe exit if consistently empty.
        // For now, let's wait 10s and continue.
        await new Promise(r => setTimeout(r, 10000));
      } else {
        // If we did work, wait a small amount to be nice to the DB
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`[Background Sync] Finished. Processed ${totalProcessed} items in ${iterations} iterations.`);
  } catch (e) {
    console.error('[Background Sync] Error:', e);
  }
};

export const config = {
  path: "/api/jobs/sync-background"
};
