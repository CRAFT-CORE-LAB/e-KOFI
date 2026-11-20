# WhatsApp wallet top-up

WhatsApp is an extra way for a parent to use the existing e-KOFI top-up. The parent portal, student portal, Intouch callback, wallet ledger, and 3% service fee are unchanged. A WhatsApp payment is a `PaymentIntent` with `channel = WHATSAPP`. When Intouch confirms it, `FinanceService.parentTopUp` credits the same student wallet the portal uses.

There is no separate parent login in e-KOFI. Knowing a student ID opens the parent portal, but it does not open a WhatsApp conversation. The school links the parent's WhatsApp number to the student, or gives the parent a one-time 6-digit link code. Student name, class, and school are sent only after that check.

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

Intouch still uses `INTOUCH_USERNAME`, `INTOUCH_ACCOUNT_NO`, `INTOUCH_PARTNER_PASSWORD`, `INTOUCH_ENV`, and `INTOUCH_CALLBACK_URL`. The callback URL stays on this API. Intouch must not be pointed at OpenAI.

Existing top-up limits stay in force: 500 to 500,000 RWF, with the current 3% service fee. The assistant cannot change those limits.

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

## Parent authorization

1. Open the student in the admin app.
2. Link the parent WhatsApp number, or create a 24-hour link code and give that code to the parent.
3. The parent messages the e-KOFI WhatsApp number, sends the student ID, and confirms the child.
4. The charge is requested on that WhatsApp number when it is a Rwandan MTN or Airtel number. Otherwise the assistant asks for the mobile-money number that will approve the prompt.

A link code is stored only as a hash. The admin screen shows the code once.

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
