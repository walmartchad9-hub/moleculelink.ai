// MOLECULELINK AI — Vercel Serverless Function
// File location: api/analyze.js
//
// This function acts as a secure middleman between your frontend and Anthropic.
// Your frontend calls /api/analyze → this function calls Anthropic with your key.
// The key is read from Vercel environment variables — never exposed in the browser.
 
module.exports = async function handler(req, res) {
  // Allow requests from your own site only
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
 
  // Read API key from Vercel environment variables (where you stored it safely)
  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_KEY environment variable not set" });
  }
 
  try {
    // Forward the request to Anthropic
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
    return res.status(200).json(data);
 
  } catch (error) {
    console.error("Anthropic API error:", error);
    return res.status(500).json({ error: "Failed to contact Anthropic API" });
  }
};
 
