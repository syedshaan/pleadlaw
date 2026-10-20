import { DOCUMENT_SCHEMAS } from "../src/draft-schema.js";

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
  const schema = Object.prototype.hasOwnProperty.call(DOCUMENT_SCHEMAS, docType)
    ? DOCUMENT_SCHEMAS[docType]
    : null;
  const submittedFields = data.fields;
  if (
    !schema ||
    !submittedFields ||
    typeof submittedFields !== "object" ||
    Array.isArray(submittedFields)
  ) {
    return sendJson(res, 400, {
      error: "Choose a supported document type and submit its required details.",
    });
  }

  const fields = {};
  for (const field of schema.fields) {
    const value =
      typeof submittedFields[field.name] === "string"
        ? submittedFields[field.name].trim()
        : "";
    const isValidDate =
      field.type !== "date" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
    if (
      !value ||
      value.length > field.maxLength ||
      (field.minLength && value.length < field.minLength) ||
      (field.options && !field.options.includes(value)) ||
      !isValidDate
    ) {
      return sendJson(res, 400, {
        error: `Please provide a valid value for "${field.label}".`,
      });
    }
    fields[field.name] = value;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[draft-petition] Gemini API key is not configured.");
    return sendJson(res, 503, {
      error: "The drafting service is not configured yet. Please try again later.",
    });
  }

  const prompt = [
    "Prepare a concise preliminary legal document for use in India, using only the structured information below.",
    `Document type: ${docType}`,
    schema.instruction,
    "Use concise formal language. Do not invent facts, dates, laws, citations, or procedural rules.",
    "Use [PLACEHOLDER] for any other missing required detail. Do not add unsupported legal citations.",
    "End with a one-sentence note that an advocate must verify the draft and filing requirements.",
    "Details:",
    ...schema.fields.map((field) => `${field.label}: ${fields[field.name]}`),
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
          generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
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
