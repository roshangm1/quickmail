# Feature roadmap

Ideas to make Quickinbox faster to live in. Ordered by build priority.

**Product stance:** a mailbox you own, that agents can drive, that does not get noisy. Superhuman’s speed + Hey’s filters + the existing MCP/CLI — not a marketing ESP.

**Do not** turn the personal send path into Mailchimp. Mass campaigns need lists, unsubscribe, warmup, and complaint handling. Resend/Cloudflare will throttle or ban a mailbox that suddenly blasts thousands of people. Broadcasts, if built, stay a separate mode.

---

## 1. Snooze / bring back

The missing inbox verb. Hide a thread until a time, then put it back on top.

- Times: later today, tomorrow, next week, pick a datetime
- Un-snooze on a new inbound reply (conversation is alive again)
- Keyboard: `h` (or similar)

**Touches:** D1 column or `snoozed_until` on threads, cron/queue to wake them, mailbox query filter, Zero + Classic UI.

---

## 2. Send later + undo send

Same outbox mental model, two wins.

- **Send later:** compose now, release at a time (quiet hours, “Monday 9am”)
- **Undo send:** hold ~30s in outbox, then send; toast with Undo

**Touches:** existing outbox, Cloudflare Queue or cron, composer + toast. Do this after snooze if they share a scheduler.

---

## 3. Rules (manual, then English → rule)

Run on inbound (`email()` / Resend webhook) so it is reliable and cheap.

Phase A — structured rules:

- If from / to / subject / list-id matches → archive, star, label, forward, skip inbox
- “Teach from this sender” on a thread

Phase B — English compiles to the same store:

- “If it’s an invoice, star it and forward to bookkeeping@”
- Show the compiled rule; user confirms before it goes live

Agents write rules; the Worker executes them. Auditable.

---

## 4. Thread summary + draft reply (confirm to send)

Agentic without auto-send.

- On a long thread: 4 bullets + “waiting on you?”
- Suggested reply in the user’s voice (from their sent mail)
- User edits and taps send. Never auto-send until they opt in

**Touches:** Workers AI or an external model key, MCP/API for “summarize / draft”, composer prefill.

---

## 5. Disposable and plus addresses

Unique to a domain you control.

- `you+stripe@` auto-labels (and can expire)
- Timed addresses: `demo-mar@`, catch-all or delete after N days
- Create from Settings in one tap — useful for signups

**Touches:** address create, inbound routing, optional expiry cron.

---

## 6. Domain health + bounce suppress

Protects the whole product before any volume send.

- One Admin screen: SPF / DKIM / DMARC / MX, last bounce, complaint rate
- Hard bounce → suppress; do not retry; suggest removing the address
- Warn when daily send looks like a blast (warmup helper)

**Touches:** DNS checks, Resend delivery events you already store, a suppressions table.

---

## 7. Daily briefing

Cron that makes MCP + push feel alive.

- “7 things waiting on you, 2 that look urgent, 1 newsletter you can skip”
- Deliver as push and/or a morning email to yourself
- Optional: unread older than 3 days, snoozes coming due

**Touches:** cron trigger, same summarizer as §4, push you already have.

---

## 8. Broadcasts (optional, only after §6)

Narrow “send this issue,” not a growth engine.

- One list, CSV import, `List-Unsubscribe` required
- Template + preview as a real recipient
- Rate limit, quiet hours, hard cap (e.g. 500/day) until reputation is healthy
- Report: delivered / bounced / complained (Resend events)
- Own From / folder — do not mix into personal Sent, or tag clearly

Call it **Broadcasts**, not Campaigns.

---

## After the first eight

Build these when the mailbox already feels fast.

### Everyday productivity

- **Templates / snippets** — `/thanks`, `/invoice`, `{{name}}`
- **Keyboard-first** — finish Gmail/Superhuman chords (e, h, snooze, next) in both themes
- **Split inbox** — Primary / Newsletters / Receipts / Social; rules + “teach from this sender”
- **Wait-on-reply badge** — you asked a question and they have not answered (no tracking pixels)
- **Saved searches as folders** — `is:unread from:github`, `has:attachment older_than:7d`

### Multi-identity

- **Per-mailbox personality** — signature, From name, reply-to, agent prompt for `jobs@` vs `hello@`
- **Send-as warning** — impossible to leak `personal@` on a `work@` thread (reply-from-received is partly done)

### Team (without becoming Slack)

- **Shared mailbox + assignment** — `support@` has an owner
- **Internal comments** on a thread (never leave the instance)
- **Handoff** — reassign without forwarding the history
- **Audit log** — who read / sent / deleted

### Agentic (deeper)

- **Inbox agent with a plan** — draft, file, snooze, summarize; show the plan; tap to apply
- **MCP that acts** — search, label, follow-up draft, “unanswered in 3 days” (read/send already exist)
- **Agent mailboxes** — `agent@`, `leads@`, `receipts@` hit a Durable Object that classifies or files; human inbox stays clean

### Cloudflare-native

- **Outbound webhooks** — mail to `hooks@` POSTs JSON to your app (email API for the rest of the stack)
- **Parse-to-structured** — receipts → amount/merchant; `.ics`; GitHub/Vercel noise → compact cards
- **Per-address Durable Object** — agent memory, rate limits
- **PWA polish** — share-to-mail, lock-screen archive/snooze, offline draft queue

### Deliverability extras

- **Block / mute sender** + instance-wide blocklist
- **Warmup helper** as a first-class domain setting (caps + warnings from §6)

---

## Suggested implementation notes

| Shared piece | Used by |
| --- | --- |
| Scheduler (Queue or cron + D1 due times) | Snooze, send later, undo send, briefing, disposable expiry |
| Rule store + inbound hook | Rules, split inbox, plus-address labels, agent mailboxes |
| Model / Workers AI | Summary, draft reply, English → rule, briefing |
| Suppressions + domain health | Bounce handling, warmup, Broadcasts |

Ship **scheduler + snooze** first. Almost everything else that is time-based plugs into it.
