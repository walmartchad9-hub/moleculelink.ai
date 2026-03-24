// MOLECULELINK AI — Vercel Serverless Function
// File location: api/analyze.js
//
// This function does two things:
// 1. Keeps your Anthropic API key secure (never exposed in the browser)
// 2. Rate limits requests so no single user can burn through your credits
//    — each IP address is limited to 10 requests per hour
 
module.exports = async function handler(req, res) {
  // Allow requests from your own site
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
 
  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
 
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
 
  // ── RATE LIMITING ─────────────────────────────────────────
  // We track requests per IP address using a simple in-memory store.
  // Each IP can make 10 requests per hour before being blocked.
  // Note: this resets when Vercel restarts the function (which is fine for pilots).
 
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    "unknown";
 
  const now = Date.now();
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds
  const MAX_REQUESTS = 10;           // max requests per hour per IP
 
  // Initialize the rate limit store if it doesn't exist
  if (!global.rateLimit) global.rateLimit = {};
 
  // Clean up old entries to prevent memory buildup
  for (const key of Object.keys(global.rateLimit)) {
    if (now - global.rateLimit[key].windowStart > WINDOW_MS) {
      delete global.rateLimit[key];
    }
  }
 
  // Check and update this IP's request count
  if (!global.rateLimit[ip]) {
    global.rateLimit[ip] = { count: 0, windowStart: now };
  }
 
  const record = global.rateLimit[ip];
 
  // Reset window if an hour has passed
  if (now - record.windowStart > WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }
 
  // Block if over limit
  if (record.count >= MAX_REQUESTS) {
    return res.status(429).json({
      error: "Rate limit reached. You can generate 10 reports per hour. Please try again later."
    });
  }
 
  // Increment count
  record.count++;
 
  // ── API KEY ───────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_KEY environment variable not set" });
  }
 
  // ── FORWARD TO ANTHROPIC ──────────────────────────────────
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(req.body)
    });
 
    const data = await response.json();
 
    // Pass remaining requests back so the frontend can show it if needed
    res.setHeader("X-RateLimit-Remaining", MAX_REQUESTS - record.count);
 
    return res.status(200).json(data);
 
  } catch (error) {
    console.error("Anthropic API error:", error);
    return res.status(500).json({ error: "Failed to contact Anthropic API" });
  }
};
 
