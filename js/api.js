/**
 * api.js
 * Calls the Netlify serverless proxy (netlify/functions/generate.js), which
 * holds the OpenRouter API key server-side so it's never exposed in the
 * browser. If the user has entered their own key in the UI, it's passed
 * along and used instead of the server's key (Option A fallback).
 */

const PROXY_URL = "/api/generate";

/**
 * Calls the proxy and returns the raw Markdown text response.
 * Throws a friendly Error on failure — never lets a raw fetch error escape.
 */
async function callOpenRouter({ apiKey, model, system, user }) {
  if (!model) {
    throw new Error("Missing AI model. Enter a model such as openai/gpt-4.1-mini.");
  }

  let response;
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, system, user, userApiKey: apiKey || undefined }),
    });
  } catch {
    throw new Error("Network error — check your internet connection and try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Received an unreadable response from the server.");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit reached. Wait a moment and try again.");
    }
    throw new Error(data?.error || `Server returned an error (status ${response.status}).`);
  }

  const content = data?.content;
  if (!content || !content.trim()) {
    throw new Error("Empty response from the model. Try a different model or topic.");
  }

  return content.trim();
}

window.CreatorAPI = { callOpenRouter };
