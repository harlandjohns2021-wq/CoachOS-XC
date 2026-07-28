# CoachOS XC

Mobile-first cross country coaching MVP.

## Current features

- Add and remove athletes
- Track sex and grade
- Daily attendance
- Record 1-mile, 2-mile, and 5K times
- Automatic PR detection
- Dashboard stats
- Automatic training groups based on latest 2-mile time, with a 1-mile fallback estimate
- AI science coach with role-aware decision support, anonymized athlete trends, evidence sources, and recommendation feedback tracking
- Coach Education section with curated coaching articles/research links and video resources
- Export and import JSON backups
- Local offline data storage
- Basic PWA manifest and service worker

## Run locally

Serve the repository with any static web server. For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## iPhone installation

Once hosted on an HTTPS site, open the app in Safari and use **Share > Add to Home Screen**.

## Current limitation

This MVP stores data locally in the browser using `localStorage`. It does not yet include user accounts, cloud sync, subscriptions, or multi-coach sharing.

## AI security controls

- Athlete names are removed before AI analysis requests.
- AI recommendation API enforces strict output normalization and source-domain filtering.
- API requests are protected with no-store responses, allowed-origin checks, and rate limiting.
- Team admins can keep AI output at team-level only or allow anonymized athlete trend summaries.

## Next priorities

1. Authentication and cloud database
2. Coach and assistant-coach access
3. Team creation and roster import
4. Daily workout and mileage logging
5. Athlete progress charts and pace calculations
6. AI-assisted runner and team analysis
7. Meet results and season projections
8. Subscription billing
