# pleadlaw

## Automatic job listings

The scheduled feed workflow runs every six hours. Matched job leads from
`jobLeads` are saved to `public/jobs-pending.json` and auto-published to
`public/jobs.json` with their source link.

Auto-published listings are marked `autoCollected`, not verified. The website
shows the source and tells readers to confirm the vacancy before applying.
Feed entries do not include an application deadline unless it is added
manually. Remove or update listings when their application deadlines pass;
the feed importer does not infer closing dates from article text.

News RSS sources include SCC Online, Bar & Bench, LiveLaw, Verdictum, and a
Google News legal-news search that identifies the publisher in each item.
News feeds are capped at three fetched entries per source per run and five
published entries per publisher. The website also interleaves stories from
different publishers so one source does not fill the first page.

Recruitment RSS searches cover Supreme Court vacancies, High Court vacancies,
legal jobs, and judicial services recruitment through Google News. These are
discovery feeds, not official sources, so matching results remain marked as
auto-collected leads and link back to the source for verification.

The importer currently reads RSS 2.0 `<item>` entries. A source without an RSS
feed needs a dedicated parser or an API integration before it can be automated.

Example official source:

```json
{
  "name": "Example Court Vacancies",
  "url": "https://example.gov.in/vacancies/feed.xml",
  "type": "rss",
  "category": "job-lead",
  "organisation": "Example Court",
  "jobType": "Government",
  "location": "India"
}
```

The workflow commits the generated JSON files to `main`; if the Vercel project
deploys from `main`, those commits trigger the website update.
