import type { LinkTokenGetResponse, PlaidApi } from 'plaid';

export const HOSTED_LINK_TIMEOUT_MS = 120_000;
export const HOSTED_LINK_POLL_INTERVAL_MS = 2_000;

export interface PlaidHostedLinkResult {
  publicToken: string;
  institutionId?: string;
  institutionName?: string;
}

type HostedLinkOutcome =
  | { status: 'pending' }
  | { status: 'success'; results: PlaidHostedLinkResult[] }
  | { status: 'exit' };

export function isPlaidHostedLinkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'secure.plaid.com'
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && url.pathname.startsWith('/hl/');
  } catch {
    return false;
  }
}

export function parseHostedLinkResponse(response: LinkTokenGetResponse): HostedLinkOutcome {
  const finishedSessions = (response.link_sessions || [])
    .filter(session => session.finished_at)
    .sort((left, right) => Date.parse(right.finished_at!) - Date.parse(left.finished_at!));
  const session = finishedSessions[0];
  if (!session) return { status: 'pending' };

  const itemResults = session.results?.item_add_results || [];
  const legacyResult = session.on_success?.public_token
    ? [{
        publicToken: session.on_success.public_token,
        institutionId: session.on_success.metadata?.institution?.institution_id || undefined,
        institutionName: session.on_success.metadata?.institution?.name || undefined
      }]
    : [];
  const results = itemResults.length > 0
    ? itemResults.map(item => ({
        publicToken: item.public_token,
        institutionId: item.institution?.institution_id || undefined,
        institutionName: item.institution?.name || undefined
      }))
    : legacyResult;
  const exit = session.exit || session.on_exit;

  if (results.length > 0 && exit) {
    throw new Error('Plaid returned conflicting completion results.');
  }
  if (results.length > 0) {
    if (results.some(result => !result.publicToken)) {
      throw new Error('Plaid completed without a valid public token.');
    }
    if (new Set(results.map(result => result.publicToken)).size !== results.length) {
      throw new Error('Plaid returned a duplicate public token.');
    }
    return { status: 'success', results };
  }
  if (exit) {
    const error = exit.error;
    if (error) {
      const supportId = exit.metadata?.request_id || session.link_session_id;
      const message = error.display_message || error.error_message || 'Plaid could not complete the connection.';
      throw new Error(supportId ? `${message} (Plaid reference: ${supportId})` : message);
    }
    return { status: 'exit' };
  }

  throw new Error(`Plaid session ${session.link_session_id} finished without a result.`);
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(done, milliseconds);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

export async function waitForHostedLink(
  client: PlaidApi,
  linkToken: string,
  signal: AbortSignal,
  timeoutMs = HOSTED_LINK_TIMEOUT_MS,
  pollIntervalMs = HOSTED_LINK_POLL_INTERVAL_MS
): Promise<PlaidHostedLinkResult[] | null> {
  const deadline = Date.now() + timeoutMs;
  while (!signal.aborted) {
    const response = await client.linkTokenGet({ link_token: linkToken });
    if (signal.aborted) return null;

    const outcome = parseHostedLinkResponse(response.data);
    if (outcome.status === 'success') return outcome.results;
    if (outcome.status === 'exit') return null;

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error('Plaid connection timed out. Start a new connection and complete it within two minutes.');
    }
    await delay(Math.min(pollIntervalMs, remaining), signal);
  }
  return null;
}
