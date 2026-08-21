-- Store a Telegram chat ID for each doctor so booking notifications can be delivered directly.
ALTER TABLE "Doctor" ADD COLUMN "telegramChatId" TEXT;
