const { Redis } = require("@upstash/redis");

const redis = Redis.fromEnv();

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

async function getAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function fetchAllActivities(token) {
  let page = 1, all = [];
  while (true) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const batch = await res.json();
    if (!batch.length) break;
    all = all.concat(batch);
    page++;
  }
  return all;
}

function toHoursMinutes(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

module.exports = async function handler(req, res) {
  if (req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = await getAccessToken();
  const activities = await fetchAllActivities(token);

  // Office commute: Ride + commute flag
  const commutes = activities.filter(
    (a) => a.type === "Ride" && a.commute === true
  );
  const commuteDistKm = commutes.reduce((s, a) => s + a.distance, 0) / 1000;
  const commuteTimeSec = commutes.reduce((s, a) => s + a.moving_time, 0);
  const co2Saved = +(commuteDistKm * 0.21).toFixed(2);

  // Runs: Run + TrailRun
  const runs = activities.filter(
    (a) => a.type === "Run" || a.type === "TrailRun"
  );
  const runDistKm = runs.reduce((s, a) => s + a.distance, 0) / 1000;
  const runTimeSec = runs.reduce((s, a) => s + a.moving_time, 0);

  const stats = {
    updatedAt: new Date().toISOString(),
    commute: {
      distance_km: Math.round(commuteDistKm),
      co2_saved_kg: co2Saved,
      time: toHoursMinutes(commuteTimeSec),
    },
    runs: {
      distance_km: Math.round(runDistKm),
      time: toHoursMinutes(runTimeSec),
    },
  };

  await redis.set("strava_stats", JSON.stringify(stats));

  res.json({ ok: true, stats });
}