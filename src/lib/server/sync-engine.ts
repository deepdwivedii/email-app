import { OAuth2Client } from 'google-auth-library';
import { decryptJson, encryptJson } from '@/lib/server/crypto';
import {
  mailboxesTable,
  type Mailbox,
  type MailboxCursor,
  type SyncRun,
  type SyncRunMode,
  type SyncRunStage,
  type SyncRunStatus,
} from '@/lib/server/db';
import { fetchWithRetry } from '@/lib/server/fetch';
import { upsertMessageAndInventory } from '@/lib/server/sync-shared';
import { getServerSupabase } from '@/lib/server/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

type GmailBackfillCursor = {
  type: 'gmail_backfill';
  q: string;
  pageToken: string | null;
  indexInPage: number;
  done: boolean;
  lastHistoryId?: string;
};

type GmailDeltaCursor = {
  type: 'gmail_history';
  startHistoryId: string;
  lastHistoryId: string;
  lastDeltaAt: string;
};

type GraphFolderCursor = {
  nextLink: string | null;
  deltaLink?: string | null;
  done: boolean;
};

type GraphBackfillCursor = {
  type: 'graph_backfill';
  folders: Record<string, GraphFolderCursor>;
};

type GraphDeltaCursor = {
  type: 'graph_delta';
  folders: Record<string, GraphFolderCursor>;
};

type SyncMetrics = {
  gmailQuotaUnits?: number;
  gmailCalls?: number;
  outlookCalls?: number;
  processedMessages?: number;
};

const GMAIL_LIST_COST_UNITS = 5;
const GMAIL_GET_COST_UNITS = 5;
const GMAIL_BACKFILL_BATCH_GET = 50;

export async function startSyncRun(userId: string, mailboxId: string, mode: SyncRunMode): Promise<SyncRun> {
  const supabase = await getServerSupabase();
  const { data: mbRows, error: mbError } = await (await mailboxesTable()).select('*').eq('id', mailboxId).limit(1);
  if (mbError) {
    throw mbError;
  }
  const mbRow = mbRows && mbRows[0];
  if (!mbRow || mbRow.userid !== userId) {
    throw new Error('Mailbox not found or forbidden');
  }
  const id = `${mailboxId}:${mode}:${Date.now()}`;
  const run: Partial<SyncRun> = {
    id,
    userId,
    mailboxId,
    mode,
    status: 'queued',
    startedAt: Date.now(),
    stage: 'listing',
    importedCount: 0,
    domainCount: 0,
    accountEvidenceCount: 0,
  };
  const { error } = await supabase.from('sync_runs').insert({
    id: run.id,
    userid: run.userId,
    mailboxid: run.mailboxId,
    mode: run.mode,
    status: run.status,
    startedat: run.startedAt,
    finishedat: null,
    stage: run.stage,
    importedcount: run.importedCount,
    domaincount: run.domainCount,
    accountevidencecount: run.accountEvidenceCount,
    error: null,
    cursorsnapshot: null,
  });
  if (error) {
    throw error;
  }
  return run as SyncRun;
}

export async function getLatestSyncRun(userId: string, mailboxId: string): Promise<SyncRun | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('sync_runs')
    .select('*')
    .eq('userid', userId)
    .eq('mailboxid', mailboxId)
    .order('startedat', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data && data[0];
  if (!row) return null;
  return mapSyncRunRow(row);
}

export async function listActiveSyncRuns(client?: SupabaseClient): Promise<SyncRun[]> {
  const supabase = client || await getServerSupabase();
  const { data, error } = await supabase
    .from('sync_runs')
    .select('*')
    .in('status', ['queued', 'running']);
  if (error) throw error;
  return (data || []).map(mapSyncRunRow);
}

function mapSyncRunRow(row: any): SyncRun {
  return {
    id: row.id,
    userId: row.userid,
    mailboxId: row.mailboxid,
    mode: row.mode,
    status: row.status,
    startedAt: row.startedat,
    finishedAt: row.finishedat ?? undefined,
    stage: row.stage,
    importedCount: row.importedcount ?? 0,
    domainCount: row.domaincount ?? 0,
    accountEvidenceCount: row.accountevidencecount ?? 0,
    error: row.error ?? undefined,
    cursorSnapshot: row.cursorsnapshot ?? undefined,
  };
}

function mapMailboxRow(row: any): Mailbox {
  return {
    id: row.id,
    userId: row.userid,
    provider: row.provider,
    email: row.email,
    tokenBlobEncrypted: row.tokenblobencrypted,
    cursor: row.cursor ?? undefined,
    connectedAt: row.connectedat,
    lastSyncAt: row.lastsyncat ?? undefined,
    displayName: row.displayname ?? undefined,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function getOrCreateMailboxCursor(mb: Mailbox, client?: SupabaseClient): Promise<MailboxCursor> {
  const supabase = client || await getServerSupabase();
  const { data, error } = await supabase.from('mailbox_cursors').select('*').eq('mailboxid', mb.id).limit(1);
  if (error) {
    throw error;
  }
  const existing = data && data[0];
  if (existing) {
    return {
      mailboxId: existing.mailboxid,
      userId: existing.userid,
      provider: existing.provider,
      backfill: existing.backfill,
      delta: existing.delta,
      updatedAt: existing.updatedat,
    };
  }
  const cursor: MailboxCursor = {
    mailboxId: mb.id,
    userId: mb.userId,
    provider: mb.provider,
    backfill: null,
    delta: null,
    updatedAt: Date.now(),
  };
  const { error: insertError } = await supabase.from('mailbox_cursors').insert({
    mailboxid: cursor.mailboxId,
    userid: cursor.userId,
    provider: cursor.provider,
    backfill: cursor.backfill,
    delta: cursor.delta,
    updatedat: cursor.updatedAt,
  });
  if (insertError) {
    throw insertError;
  }
  return cursor;
}

async function saveMailboxCursor(cursor: MailboxCursor, client?: SupabaseClient) {
  const supabase = client || await getServerSupabase();
  const { error } = await supabase
    .from('mailbox_cursors')
    .upsert(
      {
        mailboxid: cursor.mailboxId,
        userid: cursor.userId,
        provider: cursor.provider,
        backfill: cursor.backfill,
        delta: cursor.delta,
        updatedat: Date.now(),
      },
      { onConflict: 'mailboxid' }
    );
  if (error) {
    throw error;
  }
}

async function updateSyncRun(run: SyncRun, patch: Partial<SyncRun> & { status?: SyncRunStatus; stage?: SyncRunStage; cursorSnapshot?: SyncMetrics }, client?: SupabaseClient) {
  const supabase = client || await getServerSupabase();
  const next: SyncRun = { ...run, ...patch };
  const { error } = await supabase
    .from('sync_runs')
    .update({
      status: next.status,
      stage: next.stage,
      importedcount: next.importedCount,
      domaincount: next.domainCount,
      accountevidencecount: next.accountEvidenceCount,
      error: next.error ?? null,
      cursorsnapshot: patch.cursorSnapshot ?? run.cursorSnapshot ?? null,
      finishedat: next.finishedAt ?? null,
    })
    .eq('id', run.id);
  if (error) {
    throw error;
  }
}

export async function syncWorkerTick(maxMailboxesPerCycle = 50, client?: SupabaseClient): Promise<{ processed: number }> {
  const runs = await listActiveSyncRuns(client);
  if (!runs.length) {
    return { processed: 0 };
  }
  const supabase = client || await getServerSupabase();
  const mailboxIds = Array.from(new Set(runs.map(r => r.mailboxId)));
  const limitedMailboxIds = mailboxIds.slice(0, maxMailboxesPerCycle);
  const { data: mbRows, error: mbErr } = await supabase
    .from('mailboxes')
    .select('*')
    .in('id', limitedMailboxIds);
  if (mbErr) throw mbErr;
  const mailboxById = new Map<string, Mailbox>();
  for (const row of mbRows || []) {
    const mb = mapMailboxRow(row);
    mailboxById.set(mb.id, mb);
  }
  let processed = 0;
  for (const run of runs) {
    const mb = mailboxById.get(run.mailboxId);
    if (!mb) continue;
    if (run.status === 'queued') {
      await updateSyncRun(run, { status: 'running' }, client);
      run.status = 'running';
    }
    const metrics: SyncMetrics = (run.cursorSnapshot as SyncMetrics) || {};
    try {
      if (mb.provider === 'gmail') {
        const { imported, metrics: m2, done } = await processGmailRun(mb, run, metrics, client);
        run.importedCount += imported;
        const patch: Partial<SyncRun> & { cursorSnapshot: SyncMetrics } = {
          importedCount: run.importedCount,
          cursorSnapshot: m2,
        };
        if (done) {
          patch.status = 'done';
          patch.finishedAt = Date.now();
        }
        await updateSyncRun(run, patch, client);
      } else if (mb.provider === 'outlook') {
        const { imported, metrics: m2, done } = await processOutlookRun(mb, run, metrics, client);
        run.importedCount += imported;
        const patch: Partial<SyncRun> & { cursorSnapshot: SyncMetrics } = {
          importedCount: run.importedCount,
          cursorSnapshot: m2,
        };
        if (done) {
          patch.status = 'done';
          patch.finishedAt = Date.now();
        }
        await updateSyncRun(run, patch, client);
      }
      processed++;
    } catch (e: any) {
      const errorMessage = e?.message || String(e);
      const errorStack = e?.stack ? `\n${e.stack}` : '';
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('invalid_grant') || errorMessage.includes('Invalid Credentials');
      
      const patch: Partial<SyncRun> = {
        status: isAuthError ? 'needs_reauth' : 'error',
        error: (errorMessage + errorStack).slice(0, 1000),
      };
      
      await updateSyncRun(run, patch, client);
    }
  }
  return { processed };
}

async function processGmailRun(mb: Mailbox, run: SyncRun, metrics: SyncMetrics, client?: SupabaseClient): Promise<{ imported: number; metrics: SyncMetrics; done: boolean }> {
  type GmailTokenBlob = { access_token: string; refresh_token: string };
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) {
    return { imported: 0, metrics, done: true };
  }
  run.stage = 'listing';
  await updateSyncRun(run, { stage: 'listing' }, client);
  const tokens = decryptJson<GmailTokenBlob>(mb.tokenBlobEncrypted);
  const oauth = new OAuth2Client({ clientId, clientSecret });
  oauth.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  const fresh = await oauth.getAccessToken();
  const accessToken = fresh?.token || tokens.access_token;
  const cursor = await getOrCreateMailboxCursor(mb, client);
  let backfill = (cursor.backfill as GmailBackfillCursor | null) || null;
  const isBackfillMode = run.mode === 'full' || run.mode === 'quick';
  if (!backfill && isBackfillMode) {
    backfill = {
      type: 'gmail_backfill',
      q: run.mode === 'quick' ? 'newer_than:30d -in:chats' : '-in:chats',
      pageToken: null,
      indexInPage: 0,
      done: false,
      lastHistoryId: undefined,
    };
  }
  let delta = cursor.delta as GmailDeltaCursor | null;
  let imported = 0;
  const nextMetrics: SyncMetrics = { ...metrics };
  let done = false;
  if (isBackfillMode && backfill && !backfill.done) {
    run.stage = 'fetching';
    await updateSyncRun(run, { stage: 'fetching' }, client);
    const result = await gmailBackfillTick(mb, accessToken, backfill, client);
    imported += result.imported;
    backfill = result.cursor;
    nextMetrics.gmailCalls = (nextMetrics.gmailCalls || 0) + result.apiCalls;
    nextMetrics.gmailQuotaUnits = (nextMetrics.gmailQuotaUnits || 0) + result.quotaUnits;
    if (backfill.done && run.mode === 'quick') {
      done = true;
    }
  } else if (run.mode === 'delta') {
    if (!delta) {
      const seedHistoryId = backfill && backfill.lastHistoryId ? backfill.lastHistoryId : '';
      delta = {
        type: 'gmail_history',
        startHistoryId: seedHistoryId,
        lastHistoryId: seedHistoryId,
        lastDeltaAt: nowIso(),
      };
    }
    run.stage = 'fetching';
    await updateSyncRun(run, { stage: 'fetching' }, client);
    const result = await gmailDeltaTick(mb, accessToken, delta, client);
    imported += result.imported;
    delta = result.cursor;
    nextMetrics.gmailCalls = (nextMetrics.gmailCalls || 0) + result.apiCalls;
    nextMetrics.gmailQuotaUnits = (nextMetrics.gmailQuotaUnits || 0) + result.quotaUnits;
    done = true;
  } else if (run.mode === 'quick' && backfill && backfill.done) {
    done = true;
  }
  run.stage = 'upserting';
  await updateSyncRun(run, { stage: 'upserting' }, client);
  cursor.backfill = backfill;
  cursor.delta = delta;
  await saveMailboxCursor(cursor, client);
  if (run.mode === 'full' && backfill && backfill.done) {
    done = true;
  }
  run.stage = 'aggregating';
  await updateSyncRun(run, { stage: 'aggregating' }, client);
  return { imported, metrics: nextMetrics, done };
}

async function gmailBackfillTick(mb: Mailbox, accessToken: string, cursor: GmailBackfillCursor, client?: SupabaseClient): Promise<{ imported: number; cursor: GmailBackfillCursor; apiCalls: number; quotaUnits: number }> {
  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('maxResults', '500');
  if (cursor.pageToken) listUrl.searchParams.set('pageToken', cursor.pageToken);
  if (cursor.q) listUrl.searchParams.set('q', cursor.q);
  const listRes = await fetchWithRetry(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
      if (listRes.status === 401) {
        throw new Error('Gmail 401: Invalid Credentials');
      }
      throw new Error(`Gmail list failed ${listRes.status}`);
    }
  const listJson: { messages?: Array<{ id: string }>; nextPageToken?: string; historyId?: string } = await listRes.json();
  const ids: string[] = (listJson.messages || []).map(m => m.id);
  const start = cursor.indexInPage;
  const end = Math.min(start + GMAIL_BACKFILL_BATCH_GET, ids.length);
  const slice = ids.slice(start, end);
  let imported = 0;
  let lastHistoryId = cursor.lastHistoryId;
  for (const id of slice) {
    const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
    const getRes = await fetchWithRetry(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) continue;
    const msg = await getRes.json();
    const headers: Record<string, string> = {};
    for (const h of msg.payload?.headers || []) headers[h.name] = h.value;
    const dateVal = Date.parse(headers['Date']);
    await upsertMessageAndInventory(mb, {
      providerMsgId: msg.id,
      from: headers['From'],
      to: headers['To'],
      subject: headers['Subject'],
      receivedAt: isNaN(dateVal) ? Date.now() : dateVal,
      listUnsubscribe: headers['List-Unsubscribe'],
      listUnsubscribePost: headers['List-Unsubscribe-Post'],
    }, client);
    imported++;
    if (typeof msg.historyId === 'string') {
      lastHistoryId = msg.historyId;
    }
  }
  let nextIndex = end;
  let nextPageToken = cursor.pageToken;
  let done = cursor.done;
  if (end >= ids.length) {
    nextIndex = 0;
    nextPageToken = listJson.nextPageToken || null;
    if (!nextPageToken) {
      done = true;
    }
  }
  return {
    imported,
    cursor: {
      ...cursor,
      indexInPage: nextIndex,
      pageToken: nextPageToken,
      done,
      lastHistoryId,
    },
    apiCalls: 1 + slice.length,
    quotaUnits: GMAIL_LIST_COST_UNITS + slice.length * GMAIL_GET_COST_UNITS,
  };
}

async function gmailDeltaTick(mb: Mailbox, accessToken: string, cursor: GmailDeltaCursor, client?: SupabaseClient): Promise<{ imported: number; cursor: GmailDeltaCursor; apiCalls: number; quotaUnits: number }> {
  if (!cursor.lastHistoryId) {
    return { imported: 0, cursor, apiCalls: 0, quotaUnits: 0 };
  }
  const ids = new Set<string>();
  let imported = 0;
  let apiCalls = 0;
  let quotaUnits = 0;
  let pageToken: string | undefined;
  let latestHistoryId = cursor.lastHistoryId;

  do {
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
    listUrl.searchParams.set('startHistoryId', cursor.lastHistoryId);
    if (pageToken) listUrl.searchParams.set('pageToken', pageToken);
    const listRes = await fetchWithRetry(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    apiCalls++;
    if (!listRes.ok) {
      const text = await listRes.text();
      if (listRes.status === 404 || text.includes('historyId')) {
        return {
          imported: 0,
          cursor: {
            ...cursor,
            startHistoryId: '',
            lastHistoryId: '',
            lastDeltaAt: nowIso(),
          },
          apiCalls,
          quotaUnits: quotaUnits + GMAIL_LIST_COST_UNITS,
        };
      }
      throw new Error(`Gmail history failed ${listRes.status}`);
    }
    quotaUnits += GMAIL_LIST_COST_UNITS;
    const body: {
      history?: Array<{ id?: string; messagesAdded?: Array<{ message: { id: string } }>; messages?: Array<{ id: string }> }>;
      historyId?: string;
      nextPageToken?: string;
    } = await listRes.json();
    for (const h of body.history || []) {
      for (const ma of h.messagesAdded || []) {
        ids.add(ma.message.id);
      }
      for (const m of h.messages || []) {
        ids.add(m.id);
      }
    }
    if (body.historyId) {
      latestHistoryId = body.historyId;
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  const idArray = Array.from(ids);
  for (const id of idArray) {
    const getUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`;
    const getRes = await fetchWithRetry(getUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!getRes.ok) continue;
    apiCalls++;
    quotaUnits += GMAIL_GET_COST_UNITS;
    const msg = await getRes.json();
    const headers: Record<string, string> = {};
    for (const h of msg.payload?.headers || []) headers[h.name] = h.value;
    const dateVal = Date.parse(headers['Date']);
    await upsertMessageAndInventory(mb, {
      providerMsgId: msg.id,
      from: headers['From'],
      to: headers['To'],
      subject: headers['Subject'],
      receivedAt: isNaN(dateVal) ? Date.now() : dateVal,
      listUnsubscribe: headers['List-Unsubscribe'],
      listUnsubscribePost: headers['List-Unsubscribe-Post'],
    }, client);
    imported++;
  }

  return {
    imported,
    cursor: {
      ...cursor,
      lastHistoryId: latestHistoryId,
      lastDeltaAt: nowIso(),
    },
    apiCalls,
    quotaUnits,
  };
}

async function processOutlookRun(mb: Mailbox, run: SyncRun, metrics: SyncMetrics, client?: SupabaseClient): Promise<{ imported: number; metrics: SyncMetrics; done: boolean }> {
  type OutlookTokenBlob = { accessToken: string | null; refreshToken: string; expiresOn: string | null };
  const clientId = process.env.MS_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = process.env.MS_OAUTH_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) {
    return { imported: 0, metrics, done: true };
  }
  run.stage = 'listing';
  await updateSyncRun(run, { stage: 'listing' }, client);
  const tokenBlob = decryptJson<OutlookTokenBlob>(mb.tokenBlobEncrypted);
  let accessToken: string | null = tokenBlob.accessToken || null;
  const cursor = await getOrCreateMailboxCursor(mb, client);
  let backfill = cursor.backfill as GraphBackfillCursor | null;
  let delta = cursor.delta as GraphDeltaCursor | null;
  if (run.mode === 'full' && !backfill) {
    backfill = {
      type: 'graph_backfill',
      folders: {
        inbox: { nextLink: null, done: false },
        junk: { nextLink: null, done: false },
      },
    };
  }
  if (run.mode === 'delta' && !delta) {
    delta = {
      type: 'graph_delta',
      folders: {
        inbox: { nextLink: null, deltaLink: null, done: false },
        junk: { nextLink: null, deltaLink: null, done: false },
      },
    };
  }
  let imported = 0;
  const nextMetrics: SyncMetrics = { ...metrics };
  let done = false;
  if ((run.mode === 'full' || run.mode === 'quick') && backfill) {
    run.stage = 'fetching';
    await updateSyncRun(run, { stage: 'fetching' }, client);
    const result = await outlookBackfillTick(mb, accessToken!, clientId, clientSecret, backfill, client);
    imported += result.imported;
    backfill = result.cursor;
    accessToken = result.accessToken;
    nextMetrics.outlookCalls = (nextMetrics.outlookCalls || 0) + result.apiCalls;
    if (run.mode === 'quick') {
      done = true;
    }
  } else if (delta) {
    run.stage = 'fetching';
    await updateSyncRun(run, { stage: 'fetching' }, client);
    const result = await outlookDeltaTick(mb, accessToken!, clientId, clientSecret, delta, client);
    imported += result.imported;
    delta = result.cursor;
    accessToken = result.accessToken;
    nextMetrics.outlookCalls = (nextMetrics.outlookCalls || 0) + result.apiCalls;
  }
  cursor.backfill = backfill;
  cursor.delta = delta;
  run.stage = 'upserting';
  await updateSyncRun(run, { stage: 'upserting' }, client);
  await saveMailboxCursor(cursor, client);
  if (run.mode === 'full' && backfill && Object.values(backfill.folders).every(f => f.done)) {
    done = true;
  }
  if (run.mode === 'delta' && delta && Object.values(delta.folders).every(f => f.done)) {
    done = true;
  }
  run.stage = 'aggregating';
  await updateSyncRun(run, { stage: 'aggregating' }, client);
  return { imported, metrics: nextMetrics, done };
}

async function outlookBackfillTick(mb: Mailbox, accessToken: string, clientId: string, clientSecret: string, cursor: GraphBackfillCursor, client?: SupabaseClient): Promise<{ imported: number; cursor: GraphBackfillCursor; apiCalls: number; accessToken: string }> {
  const foldersOrder = Object.keys(cursor.folders);
  let imported = 0;
  let apiCalls = 0;
  let token = accessToken;
  for (const key of foldersOrder) {
    const fc = cursor.folders[key];
    if (fc.done) continue;
    const baseUrl = key === 'junk'
      ? 'https://graph.microsoft.com/v1.0/me/mailFolders/JunkEmail/messages?$select=id,subject,receivedDateTime,from,toRecipients&$top=50'
      : 'https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$select=id,subject,receivedDateTime,from,toRecipients&$top=50';
    const targetUrl = fc.nextLink || baseUrl;
    let res = await fetchWithRetry(targetUrl, { headers: { Authorization: `Bearer ${token}` } });
    apiCalls++;
    if (res.status === 401 || res.status === 403) {
      const refreshed = await refreshOutlookToken(clientId, clientSecret, mb, token, client);
      if (refreshed) {
        token = refreshed;
        res = await fetchWithRetry(targetUrl, { headers: { Authorization: `Bearer ${token}` } });
        apiCalls++;
      }
    }
    if (!res.ok) {
      throw new Error(`Graph backfill list failed ${res.status}`);
    }
    const data: { value?: Array<{ id: string }>; '@odata.nextLink'?: string } = await res.json();
    const items = data.value || [];
    for (const item of items) {
      const mRes = await fetchWithRetry(
        `https://graph.microsoft.com/v1.0/me/messages/${item.id}?$select=subject,receivedDateTime,from,toRecipients,internetMessageHeaders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      apiCalls++;
      if (!mRes.ok) continue;
      const m = await mRes.json();
      const headersArr: Array<{ name: string; value: string }> = m.internetMessageHeaders || [];
      const headers: Record<string, string> = {};
      for (const h of headersArr) headers[h.name] = h.value;
      const dateVal = Date.parse(m.receivedDateTime);
      await upsertMessageAndInventory(mb, {
        providerMsgId: m.id,
        from: m.from?.emailAddress?.address,
        to: (m.toRecipients?.[0]?.emailAddress?.address) || undefined,
        subject: m.subject,
        receivedAt: isNaN(dateVal) ? Date.now() : dateVal,
        listUnsubscribe: headers['List-Unsubscribe'],
        listUnsubscribePost: headers['List-Unsubscribe-Post'],
      }, client);
      imported++;
    }
    const nextLink = data['@odata.nextLink'] || null;
    cursor.folders[key] = {
      ...fc,
      nextLink,
      done: !nextLink,
    };
    break;
  }
  return { imported, cursor, apiCalls, accessToken: token };
}

async function outlookDeltaTick(mb: Mailbox, accessToken: string, clientId: string, clientSecret: string, cursor: GraphDeltaCursor, client?: SupabaseClient): Promise<{ imported: number; cursor: GraphDeltaCursor; apiCalls: number; accessToken: string }> {
  const foldersOrder = Object.keys(cursor.folders);
  let imported = 0;
  let apiCalls = 0;
  let token = accessToken;
  for (const key of foldersOrder) {
    const fc = cursor.folders[key];
    const baseUrl = key === 'junk'
      ? 'https://graph.microsoft.com/v1.0/me/mailFolders/JunkEmail/messages/delta?$select=id,subject,receivedDateTime,from,toRecipients,internetMessageHeaders&$top=50'
      : 'https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages/delta?$select=id,subject,receivedDateTime,from,toRecipients,internetMessageHeaders&$top=50';
    const targetUrl = fc.nextLink || fc.deltaLink || baseUrl;
    let res = await fetchWithRetry(targetUrl, { headers: { Authorization: `Bearer ${token}` } });
    apiCalls++;
    if (res.status === 401 || res.status === 403) {
      const refreshed = await refreshOutlookToken(clientId, clientSecret, mb, token, client);
      if (refreshed) {
        token = refreshed;
        res = await fetchWithRetry(targetUrl, { headers: { Authorization: `Bearer ${token}` } });
        apiCalls++;
      }
    }
    if (!res.ok) {
      throw new Error(`Graph delta list failed ${res.status}`);
    }
    const data: {
      value?: Array<{ id: string; '@removed'?: any; receivedDateTime?: string; from?: any; toRecipients?: any; internetMessageHeaders?: Array<{ name: string; value: string }> }>;
      '@odata.nextLink'?: string;
      '@odata.deltaLink'?: string;
    } = await res.json();
    const items = data.value || [];
    for (const item of items) {
      if (item['@removed']) {
        continue;
      }
      const headersArr = item.internetMessageHeaders || [];
      const headers: Record<string, string> = {};
      for (const h of headersArr) headers[h.name] = h.value;
      const dateVal = item.receivedDateTime ? Date.parse(item.receivedDateTime) : Date.now();
      await upsertMessageAndInventory(mb, {
        providerMsgId: item.id,
        from: item.from?.emailAddress?.address,
        to: (item.toRecipients?.[0]?.emailAddress?.address) || undefined,
        subject: (item as any).subject,
        receivedAt: isNaN(dateVal) ? Date.now() : dateVal,
        listUnsubscribe: headers['List-Unsubscribe'],
        listUnsubscribePost: headers['List-Unsubscribe-Post'],
      }, client);
      imported++;
    }
    const nextLink = data['@odata.nextLink'] || null;
    const deltaLink = data['@odata.deltaLink'] || fc.deltaLink || null;
    const folderDone = !nextLink && !!deltaLink;
    cursor.folders[key] = {
      ...fc,
      nextLink,
      deltaLink,
      done: folderDone,
    };
    break;
  }
  return { imported, cursor, apiCalls, accessToken: token };
}

async function refreshOutlookToken(clientId: string, clientSecret: string, mb: Mailbox, currentToken: string | null, client?: SupabaseClient): Promise<string | null> {
  type OutlookTokenBlob = { accessToken: string | null; refreshToken: string; expiresOn: string | null };
  const blob = decryptJson<OutlookTokenBlob>(mb.tokenBlobEncrypted);
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: blob.refreshToken,
    scope: 'https://graph.microsoft.com/Mail.Read offline_access openid email profile',
  });
  const res = await fetchWithRetry('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!res.ok) {
    return currentToken;
  }
  const tj = await res.json();
  const newBlob: OutlookTokenBlob = {
    accessToken: tj.access_token || null,
    refreshToken: tj.refresh_token || blob.refreshToken,
    expiresOn: tj.expires_in ? new Date(Date.now() + tj.expires_in * 1000).toISOString() : null,
  };
  const supabase = client || await getServerSupabase();
  await supabase
    .from('mailboxes')
    .update({
      tokenblobencrypted: encryptJson(newBlob),
    })
    .eq('id', mb.id);
  return newBlob.accessToken || currentToken;
}
