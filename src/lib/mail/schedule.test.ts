import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	laterToday,
	nextWeek,
	parseScheduleAt,
	parseUndoSendSeconds,
	tomorrowMorning,
	undoSendAt
} from './schedule';

test('later today is 6pm when that is more than an hour away', () => {
	const morning = new Date('2026-09-07T10:00:00');
	const at = laterToday(morning);
	assert.equal(at.getHours(), 18);
	assert.equal(at.getDate(), 7);
});

test('later today jumps three hours when 6pm is too soon', () => {
	const evening = new Date('2026-09-07T17:30:00');
	const at = laterToday(evening);
	assert.equal(at.getTime(), evening.getTime() + 3 * 60 * 60 * 1000);
});

test('tomorrow morning is 9am the next calendar day', () => {
	const at = tomorrowMorning(new Date('2026-09-07T22:00:00'));
	assert.equal(at.getDate(), 8);
	assert.equal(at.getHours(), 9);
});

test('next week lands on Monday morning', () => {
	const wednesday = new Date('2026-09-09T12:00:00');
	const at = nextWeek(wednesday);
	assert.equal(at.getDay(), 1);
	assert.equal(at.getHours(), 9);
	assert.ok(at.getTime() > wednesday.getTime());
});

test('undo send is thirty seconds out by default', () => {
	const now = new Date('2026-09-07T12:00:00.000Z');
	assert.equal(undoSendAt(now).toISOString(), '2026-09-07T12:00:30.000Z');
});

test('undo send respects a chosen hold', () => {
	const now = new Date('2026-09-07T12:00:00.000Z');
	assert.equal(undoSendAt(now, 10).toISOString(), '2026-09-07T12:00:10.000Z');
});

test('unknown undo send delays fall back to thirty seconds', () => {
	assert.equal(parseUndoSendSeconds(10), 10);
	assert.equal(parseUndoSendSeconds(0), 0);
	assert.equal(parseUndoSendSeconds(45), 30);
	assert.equal(parseUndoSendSeconds('nope'), 30);
});

test('parseScheduleAt rejects junk', () => {
	assert.equal(parseScheduleAt('nope'), null);
	assert.ok(parseScheduleAt('2026-09-07T12:00:00.000Z'));
});
