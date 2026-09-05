import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withMailboxFilter } from './folders';

test('keeps a selected mailbox on folder links', () => {
	const search = new URLSearchParams('address=addr-1');
	assert.equal(withMailboxFilter('/inbox', search), '/inbox?address=addr-1');
	assert.equal(withMailboxFilter('/sent', search), '/sent?address=addr-1');
	assert.equal(
		withMailboxFilter('/inbox?view=archive', search),
		'/inbox?view=archive&address=addr-1'
	);
});

test('leaves folder links unchanged when viewing all inboxes', () => {
	assert.equal(withMailboxFilter('/inbox', new URLSearchParams()), '/inbox');
	assert.equal(withMailboxFilter('/inbox?view=archive', new URLSearchParams()), '/inbox?view=archive');
});

test('uses the current mailbox when the href already had an address', () => {
	const search = new URLSearchParams('address=addr-2');
	assert.equal(withMailboxFilter('/inbox?address=addr-1', search), '/inbox?address=addr-2');
});
