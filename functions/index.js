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
  checkGame2048Trophy,
  checkWritingMasterTrophy,
  checkHeartthrobTrophy,
  checkKongzTempTrophies,
  checkSuikaMasterTrophy,
  checkPartyPlannerTrophy,
  checkAnnualMemberTrophy,
  checkNoNoshowTrophy,
  checkFiveDayStreakTrophy,
  checkWeekendRegularTrophy,
  hasConsecutiveDays,
  newlyEarnedTrophyIds
} = require("./trophies.js");

initializeApp();

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = defineSecret("TELEGRAM_CHAT_ID");
const BGG_API_TOKEN = defineSecret("BGG_API_TOKEN");

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

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0*39;/g, "'");
}

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
      name: nameMatch ? decodeXmlEntities(nameMatch[1]) : "",
      yearPublished: yearMatch ? yearMatch[1] : undefined
    });
  }
  return items;
}

async function fetchWithRetry(url, fetchImpl = fetch, token) {
  const options = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  let res = await fetchImpl(url, options);
  if (res.status === 202) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await fetchImpl(url, options);
  }
  if (!res.ok) {
    logger.error(`BGG 요청 실패: status=${res.status} url=${url}`);
    return null;
  }
  return res.text();
}

function sortGameCandidates(candidates) {
  return [...candidates].sort((a, b) => (Number(b.yearPublished) || 0) - (Number(a.yearPublished) || 0));
}

exports.sortGameCandidates = sortGameCandidates;

exports.searchBoardGame = onRequest({ secrets: [BGG_API_TOKEN], cors: true }, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) { res.json([]); return; }
  try {
    const xml = await fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(q)}`,
      fetch,
      BGG_API_TOKEN.value()
    );
    res.json(xml ? sortGameCandidates(parseSearchResults(xml)) : []);
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
    name: nameMatch ? decodeXmlEntities(nameMatch[1]) : "",
    yearPublished: yearMatch ? yearMatch[1] : undefined,
    thumbnail: thumbMatch ? thumbMatch[1] : undefined
  };
}

exports.getBoardGameDetail = onRequest({ secrets: [BGG_API_TOKEN], cors: true }, async (req, res) => {
  const id = (req.query.id || "").trim();
  if (!id) { res.json(null); return; }
  try {
    const xml = await fetchWithRetry(
      `https://boardgamegeek.com/xmlapi2/thing?id=${encodeURIComponent(id)}`,
      fetch,
      BGG_API_TOKEN.value()
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
    ...checkWritingMasterTrophy(memberStats.postCount || 0),
    ...checkFullHouseTrophy(fullCount || 0),
    ...checkHeartthrobTrophy(memberStats),
    ...checkKongzTempTrophies(memberStats)
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

function isTopScorer(allScores, uid) {
  if (!allScores.length) return false;
  const top = Math.max(...allScores.map((s) => s.bestScore || 0));
  if (top === 0) return false;
  const mine = allScores.find((s) => s.uid === uid);
  return !!mine && (mine.bestScore || 0) === top;
}

exports.onGameScoreUpdated = onDocumentWritten("game_scores/{uid}", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData) return;

  const uid = event.params.uid;
  const db = getFirestore();

  try {
    const scoresSnap = await db.collection("game_scores").get();
    const allScores = scoresSnap.docs.map((d) => ({ uid: d.id, bestScore: d.data().bestScore || 0 }));
    const candidates = checkGame2048Trophy(isTopScorer(allScores, uid));
    await awardTrophies(db, uid, candidates);
  } catch (err) {
    logger.error(`2048 트로피 판정 실패 (uid: ${uid})`, err);
  }
});

exports.isTopScorer = isTopScorer;

function mapSuikaScores(docs) {
  return docs.map((d) => ({ uid: d.id, bestScore: d.best || 0 }));
}

exports.onSuikaScoreUpdated = onDocumentWritten("suika_scores/{uid}", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData) return;

  const uid = event.params.uid;
  const db = getFirestore();

  try {
    const scoresSnap = await db.collection("suika_scores").get();
    const docs = scoresSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const allScores = mapSuikaScores(docs);
    const candidates = checkSuikaMasterTrophy(isTopScorer(allScores, uid));
    await awardTrophies(db, uid, candidates);
  } catch (err) {
    logger.error(`콩드랍 트로피 판정 실패 (uid: ${uid})`, err);
  }
});

exports.mapSuikaScores = mapSuikaScores;

function countPartiesByOwner(parties, ownerUid) {
  return parties.filter((p) => p.ownerUid === ownerUid).length;
}

exports.onPartyUpdated = onDocumentWritten("parties/{partyId}", async (event) => {
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;
  if (!afterData || !afterData.ownerUid) return;

  const ownerUid = afterData.ownerUid;
  const db = getFirestore();

  try {
    const partiesSnap = await db.collection("parties").where("ownerUid", "==", ownerUid).get();
    const partyCount = countPartiesByOwner(partiesSnap.docs.map((d) => d.data()), ownerUid);
    const candidates = checkPartyPlannerTrophy(partyCount);
    await awardTrophies(db, ownerUid, candidates);
  } catch (err) {
    logger.error(`파티 플래너 트로피 판정 실패 (ownerUid: ${ownerUid})`, err);
  }
});

exports.countPartiesByOwner = countPartiesByOwner;

function becameAnnualMember(beforeData, afterData) {
  if (!afterData) return false;
  const wasAnnual = beforeData?.annualMember === true;
  const isAnnual = afterData.annualMember === true;
  return isAnnual && !wasAnnual;
}

exports.onUserUpdated = onDocumentWritten("users/{uid}", async (event) => {
  const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;

  if (!becameAnnualMember(beforeData, afterData)) return;

  const uid = event.params.uid;
  const db = getFirestore();

  try {
    const candidates = checkAnnualMemberTrophy(true);
    await awardTrophies(db, uid, candidates);
  } catch (err) {
    logger.error(`연회원 트로피 판정 실패 (uid: ${uid})`, err);
  }
});

exports.becameAnnualMember = becameAnnualMember;

function confirmedAttendeesChanged(beforeData, afterData) {
  const before = JSON.stringify(beforeData?.confirmedAttendees || null);
  const after = JSON.stringify(afterData?.confirmedAttendees || null);
  return before !== after;
}

function filterConfirmedClosedEvents(posts, uid) {
  return posts.filter(
    (p) => p.type === "event" && !!p.closedAt && (p.confirmedAttendees || []).includes(uid)
  );
}

function isWeekendDate(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

exports.onPostConfirmed = onDocumentWritten("posts/{postId}", async (event) => {
  const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;

  if (!afterData || !confirmedAttendeesChanged(beforeData, afterData)) return;

  const db = getFirestore();
  const confirmedUids = afterData.confirmedAttendees || [];

  for (const uid of confirmedUids) {
    try {
      const postsSnap = await db
        .collection("posts")
        .where("type", "==", "event")
        .where("confirmedAttendees", "array-contains", uid)
        .get();

      const confirmedEvents = filterConfirmedClosedEvents(
        postsSnap.docs.map((d) => d.data()),
        uid
      );

      const eventDates = confirmedEvents
        .map((p) => p.eventDate?.toDate?.())
        .filter((d) => d instanceof Date);

      const weekendCount = eventDates.filter(isWeekendDate).length;
      const hasStreak = hasConsecutiveDays(eventDates, 5);

      const candidates = [
        ...checkNoNoshowTrophy(confirmedEvents.length),
        ...checkWeekendRegularTrophy(weekendCount),
        ...checkFiveDayStreakTrophy(hasStreak)
      ];

      await awardTrophies(db, uid, candidates);
    } catch (err) {
      logger.error(`참석 확정 트로피 판정 실패 (uid: ${uid})`, err);
    }
  }
});

exports.confirmedAttendeesChanged = confirmedAttendeesChanged;
exports.filterConfirmedClosedEvents = filterConfirmedClosedEvents;
exports.isWeekendDate = isWeekendDate;

function becamePostClosed(beforeData, afterData) {
  if (!afterData || afterData.type !== "event") return false;
  return !beforeData?.closedAt && !!afterData.closedAt;
}

exports.becamePostClosed = becamePostClosed;

exports.onPostClosed = onDocumentWritten("posts/{postId}", async (event) => {
  const beforeData = event.data.before.exists ? event.data.before.data() : undefined;
  const afterData = event.data.after.exists ? event.data.after.data() : undefined;

  if (!becamePostClosed(beforeData, afterData)) return;

  const games = afterData.games || [];
  if (!games.length) return;

  const db = getFirestore();
  for (const game of games) {
    if (!game.bggId) continue;
    try {
      await db.collection("gamePlayStats").doc(game.bggId).set(
        { name: game.name || "", playCount: FieldValue.increment(1) },
        { merge: true }
      );
    } catch (err) {
      logger.error(`게임 플레이 통계 업데이트 실패 (bggId: ${game.bggId})`, err);
    }
  }
});
