# WhatsApp wallet top-up (through Shaka)

Parents and students use Shaka's WhatsApp number as the front door to e-KOFI. Cashiers keep using the e-KOFI app, because serving a student needs the fingerprint device.

- A **parent** messages Shaka. If the number is linked to a student, or has paid for one before, e-KOFI offers that student straight away ("Would you like to send money to Keza Uwase's wallet?"). Otherwise the parent sends the student ID, or the student's full name and school, for example "Send 5,000 to Keza Uwase at Green Hills Academy". The amount can be in the same message. After the summary and **Confirm payment**, Intouch sends the MTN MoMo or Airtel Money prompt to the parent's number (or another number they give).
- A **student** (or parent) asks "balance". The balance is shown only to WhatsApp numbers the school linked to that student. Link a student's own phone the same way as a parent's, with the label "Student".

WhatsApp is an extra way to use the existing e-KOFI top-up. The parent portal, student portal, Intouch callback, wallet ledger, and 3% service fee are unchanged. A WhatsApp payment is a `PaymentIntent` with `channel = WHATSAPP`. When Intouch confirms it, `FinanceService.parentTopUp` credits the same student wallet the portal uses.

## Who can do what

| Action | Who |
| --- | --- |
| Send money to a student | Anyone who gives the student ID, or the full first and last name plus the school. This matches the parent portal, where the student ID is enough. Money only goes into the wallet. |
| Be offered a student without naming one | Numbers the school linked to the student, and numbers that already paid for the student |
| Find a student by name without the school | Only among the students this number is already linked to or paid for, so a name alone never reveals which school a child attends |
| See the balance | Only numbers the school linked (or that redeemed a 6-digit link code from the school) |

## How Shaka and e-KOFI talk

1. Meta posts every message for Shaka's number to Shaka (`mail.shaka.rw/api/webhooks/whatsapp`).
2. Shaka offers it to e-KOFI: `POST https://ekofi-api.ekofi.workers.dev/api/whatsapp/bridge`, body `{ message: { id, from, kind, text, buttonId }, shakaLead }`, signed in `X-Shaka-Signature: sha256=<HMAC of the body>`.
3. e-KOFI answers `{ handled: true }` when the message is for it: a conversation in progress, one of its buttons, a number linked to or that paid for a student, an existing student ID, or (only when Shaka has not been talking to that number about its own business, `shakaLead: false`) words such as "balance", "school", "top up", "amafaranga", or a school's name.
4. While answering, e-KOFI sends its replies through `POST https://mail.shaka.rw/api/bridge/ekofi/send`, body `{ to, text, buttons?, template? }`, signed in `X-Ekofi-Signature`. Payment results that arrive later from Intouch go out the same way.
5. If e-KOFI says no, is down, or times out, Shaka handles the message as before. Messages e-KOFI took stay out of Shaka chat and the info@ inbox (`wa_messages.source = 'ekofi'`).

Both sides use one shared secret: `SHAKA_BRIDGE_SECRET` on `ekofi-api`, `EKOFI_BRIDGE_SECRET` on Shaka's `mail` Worker.

## Where the money goes

Since 2026-11-20 every top-up (WhatsApp and the parent portal) is collected on **Shaka's IntouchPay account**, the owner's decision. e-KOFI's own Intouch login is no longer used. With `SHAKA_PAY_URL` set, e-KOFI asks Shaka:

- `POST <SHAKA_PAY_URL>/pay` with `{ requestId, amount, phone, reason }` to start the prompt.
- `POST <SHAKA_PAY_URL>/pay-status` with `{ requestId }` to check it. Shaka answers in Intouch's own fields.

Both are signed with `SHAKA_BRIDGE_SECRET`. Shaka sends Intouch its own id (`EKOFI-…`) and keeps every e-KOFI payment in its `ekofi_payments` table, so they stand apart in Shaka's books. Intouch calls back to Shaka, and Shaka posts `{ requesttransactionid }` to e-KOFI's `/api/intouch/callback`. e-KOFI never trusts a callback body: it asks `/pay-status`, which asks Intouch, before crediting the wallet (once, by its idempotency key).

Payouts (canteen withdrawals and the service-fee withdrawal) are refused while `SHAKA_PAY_URL` is set, because the money is in Shaka's account. Shaka settles with the schools.

## What you configure

Add these on the API process. On Cloudflare, set them as Worker secrets or vars. They are copied into the app when the Worker boots. Do not commit real values.

| Variable | Purpose |
| --- | --- |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID used to send messages |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business account ID, for your Meta app setup |
| `WHATSAPP_ACCESS_TOKEN` | Permanent system-user token for the Cloud API |
| `WHATSAPP_VERIFY_TOKEN` | Any private string you also enter in the Meta webhook form |
| `WHATSAPP_APP_SECRET` | Meta app secret. Incoming posts are rejected without a valid `X-Hub-Signature-256` |
| `WHATSAPP_GRAPH_VERSION` | Optional. Defaults to `v21.0` |
| `OPENAI_API_KEY` | Optional. Natural-language classification. Top-up still works from the written amount, student ID, and buttons when this is empty |
| `OPENAI_MODEL` | Optional. Defaults to `gpt-4o-mini` |
| `WHATSAPP_TEMPLATE_SUCCESS` | Approved template name for a payment receipt outside the 24-hour window |
| `WHATSAPP_TEMPLATE_FAILED` | Approved template name for a failed payment |
| `WHATSAPP_TEMPLATE_LANG` | Template language code. Defaults to `en` |
| `WHATSAPP_SESSION_MINUTES` | Idle time before a confirmation expires. Defaults to 30. Minimum 5, maximum 180 |
| `SHAKA_BRIDGE_URL` | Shaka's send endpoint, `https://mail.shaka.rw/api/bridge/ekofi/send`. When set (with the secret), every reply goes out through Shaka's number and the `WHATSAPP_ACCESS_TOKEN` direct send is not used |
| `SHAKA_BRIDGE_SECRET` | Shared HMAC secret with Shaka. Secret, never committed |

Intouch still uses `INTOUCH_USERNAME`, `INTOUCH_ACCOUNT_NO`, `INTOUCH_PARTNER_PASSWORD`, `INTOUCH_ENV`, and `INTOUCH_CALLBACK_URL`. The callback URL stays on this API. Intouch must not be pointed at OpenAI.

Top-up limits: 100 to 500,000 RWF (the minimum was 500 until 2026-11-20), with the current 3% service fee. The same limits apply on the parent portal. The assistant cannot change them.

## Meta webhook

Callback URL:

`https://ekofi-api.ekofi.workers.dev/api/whatsapp/webhook`

`api.e-kofi.com` is the same Cloudflare Worker. Intouch stays on `/api/intouch/callback` on that Worker.

Local API default: `http://localhost:3001/api/whatsapp/webhook`

Subscribe to the `messages` field. Meta sends `GET` with `hub.mode`, `hub.verify_token`, and `hub.challenge`. The API answers with the challenge only when the verify token matches.

Payment results still arrive at:

`https://<your-api-host>/api/intouch/callback`

## Database

Apply the Postgres migration:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

For the Cloudflare D1 database used by `ekofi-api`, apply:

```bash
npx wrangler d1 execute ekofi --remote --file=prisma/d1/0002_whatsapp_topup.sql
```

Use `--local` instead of `--remote` when updating a local D1 database. Then deploy the Worker as usual (`npm run deploy`), which regenerates the D1 Prisma client.

## Linking numbers (for the balance)

1. Open the student in the admin app.
2. Link the parent's (or the student's own) WhatsApp number, or create a 24-hour link code and give that code to them.
3. A linked number is offered the student when it writes to Shaka, and can ask for the balance. A number that asks for a balance it may not see is asked for the link code.
4. The charge is requested on the WhatsApp number when it is a Rwandan MTN or Airtel number. Otherwise the assistant asks for the mobile-money number that will approve the prompt.

A link code is stored only as a hash. The admin screen shows the code once.

The `ekofi_payment_success` and `ekofi_payment_failed` templates below must be created on Shaka's WhatsApp Business account (the number that now sends), not e-KOFI's own.

## Conversation

The backend keeps one WhatsApp session per phone. OpenAI may classify a message such as "I want to top up my son's wallet". It cannot confirm a payment, choose an amount that the parent did not write, or update a wallet. Amounts are parsed from the message. Payment starts only from the Confirm payment button or an explicit confirmation while the summary is on screen. An expired summary cannot start a payment.

After Intouch accepts the request, the wallet stays unchanged until the existing callback marks the intent posted. A repeated callback hits the same payment idempotency key and does not credit the wallet again. A failed or declined result does not credit the wallet.

The assistant then sends the result in the open 24-hour conversation. If Meta refuses that free-form message (window closed), the API sends the configured template. Create these templates in Meta and wait for approval before relying on them:

`ekofi_payment_success`

```text
Payment Successful. {{1}} was received for {{2}} ({{3}}). The e-KOFI wallet has been credited.
```

`ekofi_payment_failed`

```text
Payment Unsuccessful. {{1}} for {{2}} ({{3}}) could not be completed. The student wallet was not credited.
```

Body parameters, in order: amount, student name, student ID.

## Where staff can see the payment

- Parent portal activity shows "You added money on WhatsApp" and the new balance.
- Student admin page lists linked phones and recent top-ups, including pending and failed ones.
- The owner Fees page lists the channel and the payment reference next to the service fee.

Portal top-ups remain `PARENT_PORTAL`. WhatsApp top-ups are `WHATSAPP`.
