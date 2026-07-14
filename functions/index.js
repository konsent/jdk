const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");

const ADMIN_URL = "https://www.jdkclub.click/admin/";

function shouldNotify(beforeData, afterData) {
  if (!afterData) return false;
  const wasPending = beforeData?.status === "pending";
  const isPending = afterData.status === "pending";
  return isPending && !wasPending;
}

function buildMessage(afterData) {
  return `새 가입 신청이 도착했습니다.\n\n가입자 닉네임: ${afterData.nickname}\n가입자 이메일: ${afterData.email}\n\n사이트 바로가기: ${ADMIN_URL}`;
}

async function sendTelegramMessage(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    throw new Error(`Telegram API error: ${res.status} ${await res.text()}`);
  }
}

exports.notifyOnPendingSignup = onDocumentWritten(
  { document: "users/{uid}", secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID] },
  async (event) => {
    const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
    const afterData = event.data.after.exists ? event.data.after.data() : undefined;

    if (!shouldNotify(beforeData, afterData)) return;

    try {
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN.value(),
        TELEGRAM_CHAT_ID.value(),
        buildMessage(afterData)
      );
    } catch (err) {
      logger.error("텔레그램 알림 전송 실패", err);
    }
  }
);

exports.shouldNotify = shouldNotify;
exports.buildMessage = buildMessage;

function parseSearchResults(xml) {
  const items = [];
  const itemRegex = /<item[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const [, bggId, body] = match;
    const nameMatch = /<name[^>]*\bvalue="([^"]*)"/.exec(body);
    const yearMatch = /<yearpublished[^>]*\bvalue="([^"]*)"/.exec(body);
    items.push({
      bggId,
      name: nameMatch ? nameMatch[1] : "",
      yearPublished: yearMatch ? yearMatch[1] : undefined
    });
  }
  return items;
}

async function fetchWithRetry(url) {
  let res = await fetch(url);
  if (res.status === 202) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetch(url);
  }
  if (!res.ok) return null;
  return res.text();
}

exports.searchBoardGame = onRequest(async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) { res.json([]); return; }
  try {
    const xml = await fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(q)}`
    );
    res.json(xml ? parseSearchResults(xml) : []);
  } catch (err) {
    logger.error("BGG 검색 실패", err);
    res.json([]);
  }
});

exports.parseSearchResults = parseSearchResults;
exports.fetchWithRetry = fetchWithRetry;
