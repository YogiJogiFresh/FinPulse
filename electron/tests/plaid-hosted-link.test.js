const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isPlaidHostedLinkUrl,
  parseHostedLinkResponse,
  waitForHostedLink
} = require('../dist/ipc/plaid-hosted-link.js');
const { formatPlaidTransactionBank } = require('../dist/ipc/plaid-labels.js');

function response(session) {
  return {
    link_token: 'link-sandbox-test',
    created_at: null,
    expiration: null,
    link_sessions: session ? [session] : [],
    metadata: {
      initial_products: [],
      webhook: null,
      country_codes: [],
      language: null,
      redirect_uri: null,
      client_name: 'FinPulse'
    },
    request_id: 'request-test'
  };
}

test('accepts only Plaid Hosted Link URLs', () => {
  assert.equal(isPlaidHostedLinkUrl('https://secure.plaid.com/hl/abc123'), true);
  assert.equal(isPlaidHostedLinkUrl('http://secure.plaid.com/hl/abc123'), false);
  assert.equal(isPlaidHostedLinkUrl('https://secure.plaid.com.evil.test/hl/abc123'), false);
  assert.equal(isPlaidHostedLinkUrl('https://secure.plaid.com/link/abc123'), false);
  assert.equal(isPlaidHostedLinkUrl('not a URL'), false);
});

test('formats Plaid transaction bank names from institution and account', () => {
  assert.equal(
    formatPlaidTransactionBank('American Express', 'High Yield Savings Account'),
    'American Express (High Yield Savings Account)'
  );
  assert.equal(formatPlaidTransactionBank('American Express', ''), 'American Express');
  assert.equal(formatPlaidTransactionBank('', 'Checking'), 'Plaid (Checking)');
});

test('parses current and legacy successful Hosted Link results', () => {
  const current = parseHostedLinkResponse(response({
    link_session_id: 'session-current',
    finished_at: new Date().toISOString(),
    results: {
      item_add_results: [{
        public_token: 'public-sandbox-current',
        accounts: [],
        institution: { institution_id: 'ins_1', name: 'Test Bank' }
      }],
      cra_item_add_results: [],
      cra_update_results: [],
      bank_income_results: [],
      payroll_income_results: [],
      document_income_results: null
    }
  }));
  assert.deepEqual(current, {
    status: 'success',
    results: [{
      publicToken: 'public-sandbox-current',
      institutionId: 'ins_1',
      institutionName: 'Test Bank'
    }]
  });

  const legacy = parseHostedLinkResponse(response({
    link_session_id: 'session-legacy',
    finished_at: new Date().toISOString(),
    on_success: {
      public_token: 'public-sandbox-legacy',
      metadata: {
        institution: { institution_id: 'ins_2', name: 'Legacy Bank' }
      }
    }
  }));
  assert.equal(legacy.status, 'success');
  assert.equal(legacy.results[0].publicToken, 'public-sandbox-legacy');
});

test('distinguishes pending, normal exit, and Plaid failure', () => {
  assert.deepEqual(parseHostedLinkResponse(response(null)), { status: 'pending' });
  assert.deepEqual(parseHostedLinkResponse(response({
    link_session_id: 'session-exit',
    finished_at: new Date().toISOString(),
    exit: { error: null, metadata: null }
  })), { status: 'exit' });

  assert.throws(() => parseHostedLinkResponse(response({
    link_session_id: 'session-error',
    finished_at: new Date().toISOString(),
    exit: {
      error: { display_message: 'Try again later.' },
      metadata: { request_id: 'plaid-request' }
    }
  })), /Try again later.*plaid-request/);
});

test('rejects conflicting and duplicate terminal results', () => {
  assert.throws(() => parseHostedLinkResponse(response({
    link_session_id: 'session-conflict',
    finished_at: new Date().toISOString(),
    on_success: { public_token: 'public-sandbox-conflict', metadata: null },
    exit: { error: null, metadata: null }
  })), /conflicting/);

  assert.throws(() => parseHostedLinkResponse(response({
    link_session_id: 'session-duplicate',
    finished_at: new Date().toISOString(),
    results: {
      item_add_results: [
        { public_token: 'public-sandbox-duplicate', accounts: [], institution: null },
        { public_token: 'public-sandbox-duplicate', accounts: [], institution: null }
      ],
      cra_item_add_results: [],
      cra_update_results: [],
      bank_income_results: [],
      payroll_income_results: [],
      document_income_results: null
    }
  })), /duplicate/);
});

test('polls until success and stops immediately when cancelled', async () => {
  let calls = 0;
  const client = {
    async linkTokenGet() {
      calls += 1;
      return {
        data: calls === 1
          ? response(null)
          : response({
              link_session_id: 'session-success',
              finished_at: new Date().toISOString(),
              results: {
                item_add_results: [{
                  public_token: 'public-sandbox-success',
                  accounts: [],
                  institution: null
                }],
                cra_item_add_results: [],
                cra_update_results: [],
                bank_income_results: [],
                payroll_income_results: [],
                document_income_results: null
              }
            })
      };
    }
  };
  const result = await waitForHostedLink(client, 'link-sandbox-test', new AbortController().signal, 100, 1);
  assert.equal(result[0].publicToken, 'public-sandbox-success');
  assert.equal(calls, 2);

  const controller = new AbortController();
  controller.abort();
  assert.equal(await waitForHostedLink(client, 'link-sandbox-test', controller.signal, 100, 1), null);
  assert.equal(calls, 2);
});

test('times out a pending Hosted Link session', async () => {
  const client = {
    async linkTokenGet() {
      return { data: response(null) };
    }
  };
  await assert.rejects(
    waitForHostedLink(client, 'link-sandbox-test', new AbortController().signal, 5, 1),
    /timed out/
  );
});
