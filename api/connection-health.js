function setSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export default async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET for connection calibration.' });
  }

  const github = {
    provider: process.env.VERCEL_GIT_PROVIDER || null,
    repo: process.env.VERCEL_GIT_REPO_SLUG || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null
  };

  const githubLinked = github.provider === 'github' && Boolean(github.repo && github.commit);
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);

  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    vercel: {
      environment: process.env.VERCEL_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown'
    },
    openai: {
      configured: openaiConfigured,
      model: process.env.OPENAI_MODEL || 'gpt-5-mini'
    },
    github: {
      linked: githubLinked,
      ...github
    }
  });
}
