const assert = require('node:assert/strict');
const test = require('node:test');
const { isPlaidOAuthPopup, startPlaidLinkPage } = require('../dist/ipc/plaid-link-page.js');

test('allows only the named HTTPS Plaid OAuth popup', () => {
  assert.equal(
    isPlaidOAuthPopup('https://www.americanexpress.com/account/oauth/connect', 'plaid-link-oauth'),
    true
  );
  assert.equal(isPlaidOAuthPopup('http://example.com', 'plaid-link-oauth'), false);
  assert.equal(isPlaidOAuthPopup('javascript:alert(1)', 'plaid-link-oauth'), false);
  assert.equal(isPlaidOAuthPopup('https://example.com', '_blank'), false);
  assert.equal(isPlaidOAuthPopup('not a URL', 'plaid-link-oauth'), false);
});

test('serves Plaid Link from a private loopback origin', async (t) => {
  const token = 'link-production-test-token';
  const page = await startPlaidLinkPage(token);
  t.after(page.close);

  const url = new URL(page.url);
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/[a-f0-9]{48}$/);

  const response = await fetch(page.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('content-security-policy'), /cdn\.plaid\.com/);
  assert.match(await response.text(), new RegExp(token));

  const missing = await fetch(new URL('/missing', page.url));
  assert.equal(missing.status, 404);
});
