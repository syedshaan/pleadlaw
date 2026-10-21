# pleadlaw

## Automatic job listings

The scheduled feed workflow runs every six hours. Job announcements from
`jobLeads` are saved to `public/jobs-pending.json` and auto-published to
`public/jobs.json` when they have an HTTPS link, a relevant role, a recognizable
sector, and were published within the previous 20 days. Discovery includes legal
roles and internships, ministry and government openings, Big Four legal/tax/
audit/compliance opportunities, and government law-college teaching positions.
Items with a missing or invalid publication date are not published.
Old auto-collected listings are removed on each run; manually maintained
records are preserved in the JSON file, but the website only displays records
with a publication date in the 20-day window, a source link, and an identifiable
sector. The Jobs page shows up to 50 results, including at least 20 preferred
opportunities from internships, ministries, Big Four firms, and government law
colleges when enough eligible listings are available. A stated vacancy count
must be no more than 2,000 and can appear on only one listing; listings without
a stated count remain eligible. Syndicated auto-collected posts with
substantially matching job-title terms are deduplicated. Broad vacancy stories
still need a relevant role or one of the targeted opportunity types, and
auto-collected listings older than 20 days are removed on the next feed run.
Job cards display publisher-provided HTTPS images when available and use a
branded, text-led career banner otherwise. The banner links to the source
listing. Feed images can be added to existing
listings during a later feed refresh. Job cards do not show a generic employer
placeholder or an auto-collected badge; applicants are still reminded to
confirm details with the employer. The job-card grid uses the same three-column
desktop layout and landscape image ratio as the News cards, with long text
clamped to keep cards compact.

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

News cards show an image when the RSS item provides one through
`media:content`, `media:thumbnail`, an image enclosure, or an image embedded
in its description/content. Only HTTPS image URLs are accepted, and images
are loaded directly from the publisher rather than copied or proxied. Some
publishers may block external display; cards use branded artwork when an
image is missing or cannot be loaded. Existing stories gain an image the next
time their RSS item is fetched with usable image metadata. The homepage only
shows news with an image URL; the News page still includes stories without one.

Recruitment RSS searches cover Supreme Court and High Court recruitment,
legal vacancies, judicial-services opportunities, internships, ministry/legal
and policy roles, Big Four opportunities, and government law-college teaching
in India through Google News. Results must include a relevant role and job,
vacancy, recruitment, or internship signal, a recognizable sector, a valid link,
and a publication date no older than 20 days. These are discovery feeds, not official sources,
so matching results remain marked as auto-collected and unverified. Exclusion
counts are logged by reason in the GitHub Actions run log.

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
qualified advocate. The required fields change with the document type: for
example, petitions ask for court/place, parties, facts, and relief; agreements
ask for the parties and agreement terms; RTI applications ask for the public
authority and information requested. The endpoint validates the selected
document's fields before sending a concise prompt to Gemini. Field length and
output limits help control token usage.
For consumer complaints, the form also asks for complainant and seller details
and the commission level (including "Not sure"). The prompt instructs Gemini
not to invent a complaint number, verification, declaration, legal citations,
or a compensation amount based on the purchase price.
Each document type has its own output instructions: petitions, notices,
agreements, affidavits, NDAs, consumer complaints, and RTI applications receive
different headings and section structures, and Gemini is instructed not to
claim that an unsigned document has been filed, served, sworn, or executed.
The drafter asks for state and city/place context and, where applicable, a
court or commission selection. These location and forum entries are user
provided; the tool does not determine jurisdiction or confirm that a selected
court is legally appropriate. The interface tells users to confirm the forum
with a qualified advocate.

To enable drafting:

1. Create a Gemini API key in Google AI Studio. If a key has been exposed in a
   chat, source file, or public repository, revoke it and create a replacement.
   Use an authorization key or restrict a standard key to the Gemini API.
2. Add the replacement as `GEMINI_API_KEY` in the Vercel project's Environment
   Variables. Keep it server-side; do not add it to frontend code or commit it.
3. The endpoint defaults to the current budget-oriented `gemini-3.1-flash-lite`
   model. If you set an optional `GEMINI_MODEL` environment variable, use a
   model ID currently available to your Gemini API key.
4. Redeploy the Vercel project. The `/api/draft-petition` endpoint reads the
   key from the server environment and does not return it to the browser.

The endpoint and form use the same document schema in `src/draft-schema.js`.
The endpoint validates the selected document's required fields and options,
limits input and output size, and only accepts same-origin POST requests.
Google Gemini usage is subject to Google's terms, privacy policy, model
availability, and API quotas. The draft generator does not process payments.
Set usage quotas and configure rate limiting or bot protection before making
the endpoint widely available.

If generation fails, the form displays guidance for common Gemini HTTP errors.
For the exact failure status, open the Vercel project's **Deployments**, select
the active deployment, and inspect its **Functions** logs for
`/api/draft-petition`. Confirm `GEMINI_API_KEY` is set for the deployment's
environment and redeploy after changing it.
The endpoint retries transient network failures and Gemini 429/5xx responses
up to two times with short exponential backoff. Persistent quota or service
errors still require waiting or checking the Gemini project limits/status.
