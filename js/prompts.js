/**
 * prompts.js
 * Builds the system + user prompt sent to OpenRouter.
 * The AI is instructed to return Markdown headings that exactly match
 * the output cards, so script.js can parse the response section by section.
 */

// Niche-specific system prompt tweaks used by Templates.
const NICHE_HINTS = {
  Cricket: "Focus on match moments, player names, and cricketing terminology.",
  "Cricket 19": "Focus on Cricket 19 gameplay, career mode, and stadium moments.",
  "Cricket 24": "Focus on Cricket 24 gameplay, realistic graphics, and career mode.",
  BGMI: "Focus on BGMI gameplay, chicken dinners, and squad moments.",
  Minecraft: "Focus on Minecraft builds, survival, and redstone.",
  Valorant: "Focus on Valorant clutches, agent picks, and ranked climbs.",
  "Movie Review": "Focus on spoiler-free review angles and rating hooks.",
  "Tech Review": "Focus on specs, pricing, and real-world usage.",
  Programming: "Focus on code concepts explained simply.",
  "Coding Tutorial": "Focus on step-by-step teaching and beginner clarity.",
  Podcast: "Focus on guest highlights and quotable moments.",
  History: "Focus on lesser-known facts and dramatic storytelling.",
  Facts: "Focus on surprising, shareable facts.",
  News: "Focus on urgency, clarity, and neutrality.",
  Finance: "Focus on numbers, risk, and actionable takeaways.",
  Travel: "Focus on destinations, budgets, and visual appeal.",
};

const OUTPUT_SECTIONS = [
  "YouTube Titles",
  "Description",
  "Tags",
  "Hashtags",
  "Thumbnail Text",
  "Hooks",
  "Pinned Comment",
  "Instagram Caption",
  "Keywords",
  "SEO Suggestions",
  "Content Improvements",
];

function buildPrompt({ topic, category, tone, language, platform, niche }) {
  const nicheHint = niche && NICHE_HINTS[niche] ? NICHE_HINTS[niche] : "";

  const system = `You are Creator AI, an expert YouTube and Instagram growth strategist and copywriter.
Always respond ONLY in Markdown using EXACTLY these headings, in this order, each on its own line starting with "# ":
${OUTPUT_SECTIONS.map((s) => `# ${s}`).join("\n")}

Rules:
- "YouTube Titles": exactly 10 titles, numbered 1-10, each under 100 characters.
- "Description": one long SEO-optimized description (under 5000 characters).
- "Tags": exactly 30 comma-separated tags on one line.
- "Hashtags": exactly 20 hashtags separated by spaces.
- "Thumbnail Text": exactly 10 short, bold, attention-grabbing thumbnail text ideas, numbered.
- "Hooks": exactly 5 opening hooks, numbered.
- "Pinned Comment": exactly 3 pinned comment options, numbered.
- "Instagram Caption": exactly 3 caption options, numbered.
- "Keywords": three sub-lists labeled "Primary:", "Secondary:", and "Long-tail:".
- "SEO Suggestions": a bullet list of concrete SEO tips.
- "Content Improvements": bullet list of specific ways to improve click-through rate and retention.

Write in ${language}. Tone: ${tone}. Category: ${category}. Target platform: ${platform}.
${nicheHint}
Do not include any text outside the headings and their content. Do not wrap the response in code fences.`;

  const user = `Video/Content Topic: "${topic}"`;

  return { system, user };
}

// Expose to other scripts (no module bundler in use).
window.CreatorPrompts = { buildPrompt, OUTPUT_SECTIONS, NICHE_HINTS };
