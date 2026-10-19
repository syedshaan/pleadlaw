# pleadlaw

# pleadlaw

## Automatic job listings

The scheduled feed workflow runs every six hours. Job sources in
`scripts/feeds.config.json` are treated as leads by default and remain in
`public/jobs-pending.json`. To publish a source automatically, add its
official RSS feed to `jobLeads` and set `official` to `true`. You can also set
`organisation`, `jobType`, and `location` to provide display details.

Only entries with a title and an HTTPS link from a source explicitly marked
official are added to `public/jobs.json`. Feed entries do not include an
application deadline unless it is added manually. Google News and other
aggregators should remain `official: false` and require verification before
publication. Remove or update listings when their application deadlines pass;
the feed importer does not infer closing dates from article text.

The importer currently reads RSS 2.0 `<item>` entries. A source without an RSS
feed needs a dedicated parser or an API integration before it can be automated.

Example official source:

```json
{
  "name": "Example Court Vacancies",
  "url": "https://example.gov.in/vacancies/feed.xml",
  "type": "rss",
  "category": "job-lead",
  "official": true,
  "organisation": "Example Court",
  "jobType": "Government",
  "location": "India"
}
```

The workflow commits the generated JSON files to `main`; if the Vercel project
deploys from `main`, those commits trigger the website update.
