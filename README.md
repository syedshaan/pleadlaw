# pleadlaw

## Automatic job listings

The scheduled feed workflow runs every six hours. Job announcements from
`jobLeads` are saved to `public/jobs-pending.json` and auto-published to
`public/jobs.json` when they have an HTTPS link, can be identified as a legal
vacancy, have a recognizable sector, and were published within the previous
10 days. Items with a missing or invalid publication date are not published.
Old auto-collected listings are removed on each run; manually maintained
records are preserved in the JSON file, but the website only displays records
with a publication date in the 10-day window, a source link, and an identifiable
sector.

Auto-published listings are marked `autoCollected`, not verified. The website
shows the source and tells readers to confirm the vacancy before applying.
RSS summaries are shown as descriptions when the feed supplies useful text.
Vacancy counts and application deadlines are extracted only when explicitly
stated in the feed; missing details are not guessed. Many Google News RSS
results provide only a headline and a Google News article link, not the full
vacancy notice. In those cases, the card links to the article and asks readers
to check the employer's notice for complete details.

News RSS sources include SCC Online, Bar & Bench, LiveLaw, Verdictum, and a
Google News legal-news search that identifies the publisher in each item.
News feeds are capped at three fetched entries per source per run and five
published entries per publisher. The website also interleaves stories from
different publishers so one source does not fill the first page.

Recruitment RSS searches cover Supreme Court and High Court recruitment,
legal vacancies, and judicial-services opportunities in India through Google
News. Results must include legal-role and vacancy-announcement signals, a
recognizable sector, a valid link, and a publication date no older than 10
days. These are discovery feeds, not official sources, so matching results
remain marked as auto-collected and unverified. Exclusion counts are logged
by reason in the GitHub Actions run log.

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

## Consultation request form

The consultation form collects the visitor's name, age, city/state, Indian
mobile number, email, requested service, query, preferred contact method, and
consent. It does not take payment. A Vercel serverless endpoint sends the
submission to the site owner's inbox using Resend; submissions are not saved
in the website repository or a database. The visitor's email is set as the
reply-to address so the owner can respond directly.

To enable email delivery:

1. Create a Resend account and verify a sender domain/address as required by
   Resend.
2. In Vercel, open the Pleadlaw project settings and add these Environment
   Variables for Production (and Preview if needed):
   - `OWNER_EMAIL`: the inbox that should receive consultation requests.
   - `RESEND_API_KEY`: the private Resend API key. Keep it in Vercel only; do
     not put it in frontend code or commit it.
   - `RESEND_FROM_EMAIL`: the verified sender, for example
     `Pleadlaw <consultations@your-verified-domain>`.
3. Redeploy the site after saving the variables, then submit a test request.

The endpoint validates the form and checks that the request comes from the
same site. Configure rate limiting or bot protection in Vercel for the API
route before sharing the form publicly. Email delivery depends on the Resend
account and verified sender being configured correctly.

## AI drafting

The AI Drafter sends the selected document type and visitor-provided details to
a Vercel serverless endpoint, which calls Google Gemini. Draft details are not
saved by the website. Visitors should avoid entering unnecessary confidential
or personal information and should have every generated draft reviewed by a
qualified advocate.

To enable drafting:

1. Create a Gemini API key in Google AI Studio. If a key has been exposed in a
   chat, source file, or public repository, revoke it and create a replacement.
   Use an authorization key or restrict a standard key to the Gemini API.
2. Add the replacement as `GEMINI_API_KEY` in the Vercel project's Environment
   Variables. Keep it server-side; do not add it to frontend code or commit it.
3. Redeploy the Vercel project. The `/api/draft-petition` endpoint reads the key
   from the server environment and does not return it to the browser.

The endpoint currently supports the document types in the Drafter form, limits
input size, and only accepts same-origin POST requests. Google Gemini usage is
subject to Google's terms, privacy policy, model availability, and API quotas.
The draft generator does not process payments. Set usage quotas and configure
rate limiting or bot protection before making the endpoint widely available.
