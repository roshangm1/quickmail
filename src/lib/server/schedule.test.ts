import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { D1Database } from '@cloudflare/workers-types';
import { claimNextDueEmail, type DueRow } from './schedule';

const due: DueRow = {
	id: 'mail-1',
	user_id: 'user-1',
	from_addr: 'ada@example.com',
	from_name: 'Ada',
	to_addr: 'grace@example.com',
	cc_addr: null,
	bcc_addr: null,
	subject: 'Hello',
	body_text: 'Hi',
	body_html: '<p>Hi</p>',
	in_reply_to: null,
	references_header: null,
	domain_id: 'dom-1',
	address_id: 'addr-1',
	created_at: '2026-09-05T12:00:00.000Z'
};

function mockClaimDb(claims: Array<DueRow | null>): D1Database {
	let index = 0;
	return {
		prepare(sql: string) {
			assert.match(sql, /AND status = 'scheduled'/);
			assert.match(sql, /RETURNING/);
			return {
				bind() {
					return this;
				},
				async first() {
					const next = claims[index] ?? null;
					index += 1;
					return next;
				}
			};
		}
	} as unknown as D1Database;
}

test('the first flush claims a due row', async () => {
	const claimed = await claimNextDueEmail(mockClaimDb([due]));
	assert.equal(claimed?.id, 'mail-1');
});

test('a second flush does not claim a row the first flush already took', async () => {
	const db = mockClaimDb([due, null]);
	assert.equal((await claimNextDueEmail(db))?.id, 'mail-1');
	assert.equal(await claimNextDueEmail(db), null);
});
