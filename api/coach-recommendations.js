const ALLOWED_RESEARCH_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'acsm.org',
  'journals.humankinetics.com',
  'bjsm.bmj.com',
  'worldathletics.org'
];

const ALLOWED_SCOPE = ['teamTrends', 'athleteTrends', 'workloadBalance', 'raceReadiness', 'coachQueries'];
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 40;

function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function resolveAllowedOrigins(req) {
  const explicit = String(process.env.ALLOWED_APP_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const host = req.headers.host ? `https://${req.headers.host}` : '';
  return [...new Set([...explicit, host, 'http://localhost:3000', 'http://localhost:8000'])];
}

function isAllowedOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return true;
  return resolveAllowedOrigins(req).includes(origin);
}

function tooManyRequests(req) {
  const now = Date.now();
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim() || 'unknown';
  const key = `ai:${ip}`;
  const store = globalThis.__coachosRateLimitStore || (globalThis.__coachosRateLimitStore = new Map());
  const existing = store.get(key);
  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    store.set(key, { windowStart: now, count: 1 });
    return false;
  }
  existing.count += 1;
  store.set(key, existing);
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const pieces = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') pieces.push(content.text);
    }
  }
  return pieces.join('\n').trim();
}

function parseJsonText(text) {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function cleanText(value, max = 360) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, max);
}

function normalizePriorities(priorities) {
  if (!Array.isArray(priorities)) return [];
  return priorities.slice(0, 5).map((row) => ({
    title: cleanText(row?.title, 120),
    finding: cleanText(row?.finding, 260),
    why: cleanText(row?.why, 260),
    action: cleanText(row?.action, 260),
    measure: cleanText(row?.measure, 220),
    evidence: cleanText(row?.evidence, 220)
  })).filter((row) => row.title && row.action);
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.slice(0, 8).map((source) => {
    const title = cleanText(source?.title, 180);
    const url = cleanText(source?.url, 300);
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');
      if (!ALLOWED_RESEARCH_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) return null;
      return { title: title || url, url: parsed.toString() };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function normalizeAthleteTrends(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((row) => ({
    athleteId: cleanText(row?.athleteId, 40),
    focus: cleanText(row?.focus, 100),
    trend: cleanText(row?.trend, 160),
    action: cleanText(row?.action, 180)
  })).filter((row) => row.athleteId && (row.focus || row.trend || row.action));
}

function normalizeCoachQueries(input) {
  if (!Array.isArray(input)) return [];
  return input.map((value) => cleanText(value, 160)).filter(Boolean).slice(0, 8);
}

function normalizeList(input, max = 6, itemMax = 200) {
  if (!Array.isArray(input)) return [];
  return input.map((value) => cleanText(value, itemMax)).filter(Boolean).slice(0, max);
}

function normalizeScopeCoverage(input, requestedScope) {
  const values = Array.isArray(input) ? input : requestedScope;
  const normalized = values.map((value) => cleanText(value, 40)).filter((value) => ALLOWED_SCOPE.includes(value));
  return [...new Set(normalized)];
}

function normalizeRecommendation(raw, requestedScope, insufficiencyContext = []) {
  const priorities = normalizePriorities(raw?.priorities);
  return {
    headline: cleanText(raw?.headline, 120) || 'Program outlook',
    winningScore: Number.isFinite(Number(raw?.winningScore)) ? Math.max(0, Math.min(100, Math.round(Number(raw.winningScore)))) : 0,
    summary: cleanText(raw?.summary, 500) || 'Insufficient data for reliable recommendation detail.',
    priorities: priorities.length ? priorities : [{
      title: 'Collect stronger baseline data',
      finding: 'Current data depth is limited for stable AI recommendations.',
      why: 'Low data quality can create misleading confidence.',
      action: 'Record more attendance, practice logs, and timed efforts before changing training strategy.',
      measure: 'Coverage and repeated efforts increase over the next 2–3 weeks.',
      evidence: 'Decision-support quality depends on repeated valid observations.'
    }],
    sources: normalizeSources(raw?.sources),
    scopeCoverage: normalizeScopeCoverage(raw?.scopeCoverage, requestedScope),
    insufficientData: [...new Set([...normalizeList(raw?.insufficientData), ...normalizeList(insufficiencyContext)])].slice(0, 8),
    athleteTrends: normalizeAthleteTrends(raw?.athleteTrends),
    workloadBalance: cleanText(raw?.workloadBalance, 240),
    raceReadiness: cleanText(raw?.raceReadiness, 240),
    coachQueries: normalizeCoachQueries(raw?.coachQueries)
  };
}

function buildPrompt({ serialized, requestedScope, role, athleteDetail, feedbackSummary, insufficiencyContext }) {
  return `
You are the evidence-focused cross-country program analyst for a middle-school and high-school coaching app.

Analyze the anonymized team data below and explain how the program can become a winning team. Use current peer-reviewed endurance-running research found with web search. Prioritize systematic reviews, meta-analyses, consensus statements, major governing-body guidance, and well-designed studies.

Safety and control rules:
- Recommendations are decision support only. The coach retains final control.
- Do not diagnose injuries or prescribe medical treatment.
- Keep recommendations age-appropriate; avoid copying elite-adult training loads.
- Most training should remain low intensity. Never recommend hard days on consecutive days.
- Never include athlete names; only anonymized IDs if athlete-level detail is requested.

AI request context:
- Role view: ${role}
- Athlete detail mode: ${athleteDetail}
- Requested scope: ${requestedScope.join(', ') || 'teamTrends'}
- Feedback loop summary: accepted=${feedbackSummary?.accepted || 0}, rejected=${feedbackSummary?.rejected || 0}, tracked=${feedbackSummary?.trackedRecommendations || 0}
- Known data sufficiency limitations: ${(insufficiencyContext || []).join(' | ') || 'none'}

Important coaching context:
- High-school boys in this program commonly race 3 miles or 5K.
- High-school girls in this program commonly race 2 miles or 3K.
- Junior-high races in this program commonly use 2 miles or 3K.
- Courses may be slightly short or long. Preserve exact entered distance.
- Winning-team analysis should emphasize top-five scoring strength, 1-to-5 compression, 6-7 depth, attendance, development rate, pacing, aerobic consistency, threshold development, recovery, strength, and championship timing.

Return ONLY valid JSON with this exact shape:
{
  "headline": "short outlook headline",
  "winningScore": 0,
  "summary": "2-4 sentence program-level assessment",
  "priorities": [
    {
      "title": "priority title",
      "finding": "what the team data shows",
      "why": "why it matters for winning",
      "action": "specific next coaching action with safe progression",
      "measure": "how the coach will know whether it worked",
      "evidence": "brief evidence basis with study type or governing-body guidance"
    }
  ],
  "sources": [{ "title": "source title", "url": "https://..." }],
  "scopeCoverage": ["teamTrends", "athleteTrends", "workloadBalance", "raceReadiness", "coachQueries"],
  "insufficientData": ["data limitation message"],
  "athleteTrends": [{ "athleteId": "Runner 1", "focus": "focus area", "trend": "trend summary", "action": "next step" }],
  "workloadBalance": "workload balance summary",
  "raceReadiness": "race readiness summary",
  "coachQueries": ["natural-language question the coach can ask next"]
}

Rules:
- Give 3-5 priorities.
- Include 3-8 sources actually used from allowed research domains.
- If data is weak, say so and reduce certainty.
- Only fill sections relevant to requested scope; keep others concise.

ANONYMIZED TEAM DATA:
${serialized}
`;
}

export default async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST for coaching analysis.' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }

  if (tooManyRequests(req)) {
    return res.status(429).json({ error: 'Too many requests. Please retry in a few minutes.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured in Vercel.' });
  }

  const snapshot = req.body?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    return res.status(400).json({ error: 'A team snapshot is required.' });
  }

  const athleteCount = Number(snapshot?.team?.athleteCount || 0);
  if (athleteCount < 1 || athleteCount > 250) {
    return res.status(400).json({ error: 'The roster size is invalid.' });
  }

  const serialized = JSON.stringify(snapshot);
  if (serialized.length > 180000) {
    return res.status(413).json({ error: 'The team snapshot is too large. Export older seasons before retrying.' });
  }

  const aiSettings = req.body?.aiSettings || {};
  const requestedScope = ALLOWED_SCOPE.filter((key) => aiSettings?.scope?.[key] === true);
  if (!requestedScope.length) requestedScope.push('teamTrends');
  const role = aiSettings?.role === 'assistant_coach' ? 'assistant_coach' : 'head_coach';
  const athleteDetail = aiSettings?.athleteDetail === 'anonymized' ? 'anonymized' : 'team_only';
  const feedbackSummary = req.body?.feedbackSummary || { accepted: 0, rejected: 0, trackedRecommendations: 0 };
  const insufficiencyContext = Array.isArray(req.body?.insufficiencyContext) ? req.body.insufficiencyContext : [];

  const prompt = buildPrompt({ serialized, requestedScope, role, athleteDetail, feedbackSummary, insufficiencyContext });

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `******
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        store: false,
        tools: [{
          type: 'web_search',
          search_context_size: 'medium',
          filters: { allowed_domains: ALLOWED_RESEARCH_DOMAINS }
        }],
        input: prompt,
        max_output_tokens: 2600
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || 'OpenAI could not generate coaching recommendations.';
      return res.status(response.status).json({ error: message });
    }

    const text = extractOutputText(payload);
    if (!text) return res.status(502).json({ error: 'The AI response was empty.' });

    let parsed;
    try {
      parsed = parseJsonText(text);
    } catch {
      return res.status(502).json({ error: 'The AI response was not valid recommendation data.' });
    }

    return res.status(200).json(normalizeRecommendation(parsed, requestedScope, insufficiencyContext));
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'The AI coaching endpoint failed.' });
  }
}
