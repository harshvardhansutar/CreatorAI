/**
 * netlify/functions/generate.js
 *
 * Serverless proxy so the OpenRouter API key never reaches the browser.
 * The key lives only in Netlify's environment variable OPENROUTER_API_KEY.
 *
 * Also does very lightweight, best-effort in-memory rate limiting per IP.
 * NOTE: Netlify Functions are stateless between cold starts, so this counter
 * resets whenever a new instance spins up — it is NOT a substitute for a
 * real rate limiter (e.g. Upstash Redis / Netlify Blobs) in production.
 * It just blunts casual abuse/accidental loops.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// In-memory, best-effort only (see note above).
const RATE_LIMIT = { windowMs: 60 * 60 * 1000, maxRequests: 20 };
const hits = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT.maxRequests;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] || "unknown";
  if (isRateLimited(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: "Rate limit reached. Try again later." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { model, system, user, userApiKey } = body;
  if (!model || !system || !user) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing model, system, or user in request." }) };
  }

  // Allow a visitor to optionally supply their own key (Option A) — otherwise
  // fall back to the server-side key configured in Netlify env vars.
  const apiKey = userApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server is not configured with an OpenRouter API key." }) };
  }

  // Basic sanity caps so a single request can't be abused into a huge bill.
  const safeModel = String(model).slice(0, 100);

  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": event.headers.referer || "https://creator-ai.netlify.app",
        "X-Title": "Creator AI",
      },
      body: JSON.stringify({
        model: safeModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.8,
        max_tokens: 3000,
      }),
    });
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: "Network error reaching OpenRouter." }) };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || `OpenRouter returned status ${response.status}.`;
    return { statusCode: response.status, body: JSON.stringify({ error: message }) };
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    return { statusCode: 502, body: JSON.stringify({ error: "Empty response from the model." }) };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.trim() }),
  };
};
