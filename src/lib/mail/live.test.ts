import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAIL_CHANGED_MESSAGE, MAILBOX_IDLE_REFRESH_MS } from './live';

test('idle mailbox refresh is a slow fallback, not a one-second poll', () => {
	assert.ok(MAILBOX_IDLE_REFRESH_MS >= 15_000);
	assert.equal(MAIL_CHANGED_MESSAGE, 'mail:changed');
});
