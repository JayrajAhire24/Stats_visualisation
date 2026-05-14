const { Redis } = require("@upstash/redis");
const redis = Redis.fromEnv();

function formatDistance(km) {
  return km.toLocaleString("en-US") + " km";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=86400");

  const raw = await redis.get("strava_stats");

  if (!raw) {
    return res.status(503).json({ error: "Stats not yet synced. Trigger /api/strava-sync first." });
  }

  const stats = typeof raw === "string" ? JSON.parse(raw) : raw;

  res.json({
    commute_distance_km: formatDistance(stats.commute.distance_km),
    commute_co2_saved_kg: stats.commute.co2_saved_kg + " kg",
    commute_time: stats.commute.time,
    runs_distance_km: formatDistance(stats.runs.distance_km),
    runs_time: stats.runs.time,
  });
};