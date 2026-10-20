const ALLOWED_DOCUMENT_TYPES = new Set([
  "Basic Petition",
  "Legal Notice (non-payment / cheque bounce)",
  "Rent / Leave and Licence Agreement",
  "General Affidavit",
  "NDA",
  "Consumer Complaint",
  "RTI Application",
]);

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getRequestData(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin !== "string" || typeof host !== "string") return false;

  try {
    const originUrl = new URL(origin);
    const isLocal = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
    return (
      originUrl.host.toLowerCase() === host.toLowerCase() &&
      (originUrl.protocol === "https:" || (isLocal && originUrl.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Only POST requests are accepted." });
  }

  if (!isSameOrigin(req)) {
    return sendJson(res, 403, { error: "Request origin is not allowed." });
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > 12_000) {
    return sendJson(res, 413, { error: "The submitted details are too large." });
  }

  const data = getRequestData(req);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return sendJson(res, 400, { error: "Please submit valid drafting details." });
  }

  const docType = typeof data.docType === "string" ? data.docType.trim() : "";
  const details = typeof data.details === "string" ? data.details.trim() : "";
  if (!ALLOWED_DOCUMENT_TYPES.has(docType) || details.length < 20 || details.length > 8000) {
    return sendJson(res, 400, {
      error: "Choose a supported document type and provide 20 to 8,000 characters of details.",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[draft-petition] Gemini API key is not configured.");
    return sendJson(res, 503, {
      error: "The drafting service is not configured yet. Please try again later.",
    });
  }

  const prompt = [
    "Create a preliminary legal document draft for use in India.",
    `Document type: ${docType}`,
    "Use only facts supplied by the user. Do not invent facts, dates, laws, case citations, or procedural requirements.",
    "If necessary information is missing, insert clear [PLACEHOLDER] text instead of guessing.",
    "Use clear, formal language and organize the draft with suitable headings.",
    "Include a short note at the end that an advocate must verify the applicable law, facts, and filing requirements.",
    "",
    "User-provided details:",
    details,
  ].join("\n");

  let response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.2 },
        }),
      }
    );
  } catch (error) {
    console.error(
      "[draft-petition] Gemini request failed:",
      error instanceof Error ? error.message : "Unknown network error"
    );
    return sendJson(res, 502, {
      error: "The drafting service could not be reached. Please try again later.",
    });
  }

  if (!response.ok) {
    console.error(`[draft-petition] Gemini returned HTTP ${response.status}.`);
    return sendJson(res, 502, {
      error: "Draft generation failed. Please try again later.",
    });
  }

  let result;
  try {
    result = await response.json();
  } catch {
    console.error("[draft-petition] Gemini returned invalid JSON.");
    return sendJson(res, 502, {
      error: "The drafting service returned an invalid response. Please try again.",
    });
  }

  const draft = result?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  if (!draft) {
    console.error("[draft-petition] Gemini response did not contain draft text.");
    return sendJson(res, 502, {
      error: "The drafting service did not return a draft. Please revise your details and try again.",
    });
  }

  return sendJson(res, 200, { draft });
}
