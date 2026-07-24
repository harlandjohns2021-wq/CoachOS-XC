const ALLOWED_RESEARCH_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'acsm.org',
  'journals.humankinetics.com',
  'bjsm.bmj.com',
  'worldathletics.org'
];

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST for coaching analysis.' });
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

  const prompt = `
You are the evidence-focused cross-country program analyst for a middle-school and high-school coaching app.

Analyze the anonymized team data below and explain how the program can become a winning team. Use current peer-reviewed endurance-running research found with web search. Prioritize systematic reviews, meta-analyses, consensus statements, major governing-body guidance, and well-designed studies. Do not diagnose injuries, prescribe treatment, or shame athletes. Avoid pretending that one poor practice proves fatigue.

Important coaching context:
- High-school boys commonly race 5K.
- High-school girls in this program commonly race 3K.
- Courses may be slightly short or long. Preserve the exact entered distance. Treat courses within about 5% of a standard distance as comparable context, but do not call them identical PR courses.
- Winning-team analysis should emphasize top-five scoring strength, 1-to-5 compression, runners 6-7 depth, attendance, development rate, pacing, aerobic consistency, threshold development, recovery, strength, and championship timing.
- Recommendations must be age-appropriate and must not blindly copy elite-adult mileage or intensity.
- Most training should remain low intensity. Never recommend hard days on consecutive days.

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
      "action": "specific next coaching action, including frequency or progression when justified",
      "measure": "how the coach will know whether it worked",
      "evidence": "brief evidence basis with study type or governing-body guidance"
    }
  ],
  "sources": [
    { "title": "source title", "url": "https://..." }
  ]
}

Rules:
- Give 3-5 priorities.
- winningScore is a cautious 0-100 readiness/development score, not a prediction of guaranteed wins.
- Use exact numbers from the team data when useful.
- State when the data is insufficient.
- Include 3-8 sources actually used.
- Never include athlete names because none are needed.

ANONYMIZED TEAM DATA:
${serialized}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
        max_output_tokens: 2200
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

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'The AI coaching endpoint failed.' });
  }
}
