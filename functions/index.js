const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  checkAttendanceTrophies,
  checkScheduleMakerTrophy,
  checkFullHouseTrophy,
  newlyEarnedTrophyIds
} = require("./trophies.js");

initializeApp();

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

async function fetchWithRetry(url, fetchImpl = fetch) {
  let res = await fetchImpl(url);
  if (res.status === 202) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetchImpl(url);
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

function parseGameDetail(xml, bggId) {
  const itemMatch = /<item[^>]*\bid="[^"]+"[^>]*>([\s\S]*?)<\/item>/.exec(xml);
  if (!itemMatch) return null;
  const body = itemMatch[1];
  const nameMatch = /<name[^>]*\btype="primary"[^>]*\bvalue="([^"]*)"/.exec(body);
  const yearMatch = /<yearpublished[^>]*\bvalue="([^"]*)"/.exec(body);
  const thumbMatch = /<thumbnail>([^<]*)<\/thumbnail>/.exec(body);
  return {
    bggId,
    name: nameMatch ? nameMatch[1] : "",
    yearPublished: yearMatch ? yearMatch[1] : undefined,
    thumbnail: thumbMatch ? thumbMatch[1] : undefined
  };
}

exports.getBoardGameDetail = onRequest(async (req, res) => {
  const id = (req.query.id || "").trim();
  if (!id) { res.json(null); return; }
  try {
    const xml = await fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/thing?id=${encodeURIComponent(id)}`
    );
    res.json(xml ? parseGameDetail(xml, id) : null);
  } catch (err) {
    logger.error("BGG 상세 조회 실패", err);
    res.json(null);
  }
});

exports.parseGameDetail = parseGameDetail;

function buildTrophyCandidates(memberStats, fullCount) {
  if (!memberStats) return [];
  return [
    ...checkAttendanceTrophies(memberStats.attendCount || 0),
    ...checkScheduleMakerTrophy(memberStats.postCount || 0),
    ...checkFullHouseTrophy(fullCount || 0)
  ];
}

function countFullHouseEvents(posts, authorUid) {
  return posts.filter(
    (p) => p.authorUid === authorUid && (p.attendees?.length || 0) >= p.maxAttendees
  ).length;
}

async function awardTrophies(db, uid, candidateIds) {
  if (!candidateIds.length) return;
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return;

  const existing = userSnap.data().trophies || [];
  const existingIds = existing.map((t) => t.id);
  const toAward = newlyEarnedTrophyIds(existingIds, candidateIds);
  if (!toAward.length) return;

  const newEntries = toAward.map((id) => ({
    id,
    earnedAt: new Date(),
    seen: false
  }));
  await userRef.update({
    trophies: FieldValue.arrayUnion(...newEntries)
  });
}

exports.onStatsUpdated = onDocumentWritten("stats/global", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData) return;

  const db = getFirestore();
  const members = afterData.members || {};

  for (const [uid, memberStats] of Object.entries(members)) {
    try {
      const postsSnap = await db
        .collection("posts")
        .where("type", "==", "event")
        .where("authorUid", "==", uid)
        .get();
      const fullCount = countFullHouseEvents(
        postsSnap.docs.map((d) => d.data()),
        uid
      );
      const candidates = buildTrophyCandidates(memberStats, fullCount);
      await awardTrophies(db, uid, candidates);
    } catch (err) {
      logger.error(`트로피 판정 실패 (uid: ${uid})`, err);
    }
  }
});

exports.buildTrophyCandidates = buildTrophyCandidates;
exports.countFullHouseEvents = countFullHouseEvents;
