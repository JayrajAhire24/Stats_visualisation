import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=21600");

  const raw = await redis.get("strava_stats");

  if (!raw) {
    return res.status(503).json({ error: "Stats not yet synced. Trigger /api/strava-sync first." });
  }

  const stats = typeof raw === "string" ? JSON.parse(raw) : raw;

  // Flatten for Framer's Add Fetch
  res.json({
    commute_distance_km: stats.commute.distance_km,
    commute_co2_saved_kg: stats.commute.co2_saved_kg,
    commute_time: stats.commute.time,
    runs_distance_km: stats.runs.distance_km,
    runs_time: stats.runs.time,
  });
}