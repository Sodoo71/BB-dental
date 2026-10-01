# Telegram notifications and appointment buttons

1. Deploy this version to the public HTTPS site. Set `TELEGRAM_BOT_TOKEN` in that server's environment. Set `APP_URL` to the production HTTPS origin if requests arrive through a proxy or preview domain.
2. Sign in as an administrator and open **Тохиргоо → Telegram мэдэгдлийн тохиргоо**.
3. Click **Telegram холбох** on the production site, then **Холболт шалгах**. This registers `/api/telegram/webhook` for `message` and `callback_query` updates without discarding pending updates.
4. Each doctor opens the bot and sends `/start`, saves the returned positive personal Chat ID under **Миний профайл → Telegram Chat ID**, then clicks **Туршилтын мэдэгдэл илгээх**. Group IDs and usernames cannot authorize appointment actions.

The setup uses `TELEGRAM_WEBHOOK_SECRET` when configured. Otherwise it generates a random server-side secret in the `telegram_webhook_secret` system setting. The settings API and backups do not return that secret. Register the webhook again after changing the secret, token, or production domain. A bot has one webhook; do not connect a preview site to the production bot.

New public bookings, reception-created bookings, and transfers notify the assigned doctor's saved Chat ID. The configured admin channel receives an informational copy. `notificationSent` reflects delivery to the doctor, not the channel copy. Telegram notification failures do not roll back an already saved appointment.

Appointment buttons require the assigned active doctor and active linked account in that doctor's private chat. Confirmed appointments keep a cancel button; terminal appointments cannot be reopened by repeated clicks. Status changes are audited. User-supplied names and complaints use plain text so Telegram markup characters cannot break delivery.

Run `bun test tests/telegram.test.ts tests/telegram.integration.test.js` for mocked delivery and callback checks. These tests do not send real messages or update the live database.

## Local development: setup returns HTTP 400

Telegram cannot deliver webhooks to `http://localhost:3000`. To test locally, provide a public HTTPS tunnel that forwards to this Next.js server, then set `TELEGRAM_WEBHOOK_BASE_URL="https://YOUR-TUNNEL-HOST"` in `.env`, restart `next dev`, and click **Telegram холбох** again. Keep the tunnel running while testing. This is an origin; the application appends `/api/telegram/webhook` automatically.

Keep `APP_URL` equal to the origin you use in the browser (or leave it unset locally). Changing it to a remote address while browsing localhost will fail the application's same-origin checks. The tunnel must forward to this same server so that the webhook secret matches. For production, deploy the latest code and connect from the production site instead of pointing a local setup at an unrelated deployment.

Reference: [Telegram webhook requirements](https://core.telegram.org/bots/webhooks).
