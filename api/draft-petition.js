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
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  const prompt = [
    "Prepare a concise preliminary legal document for use in India, using only the structured information below.",
    `Document type: ${docType}`,
    schema.instruction,
    "Use concise formal language. Never infer missing facts or add a legal rule, citation, date, address, amount, procedural step, or allegation not given in the form.",
    "Do not use generic [PLACEHOLDER] text unless the document cannot be understood without an unknown detail. Omit unknown administrative details such as case numbers.",
    "Never claim that a document has been signed, filed, sworn, served, registered, or verified. Follow the selected document's specific instructions for any clearly unsigned, blank completion section.",
    "Details:",
    ...schema.fields.map((field) => `${field.label}: ${fields[field.name]}`),
  ].join("\n");

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
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
    let error;
    if ([400, 401, 403].includes(response.status)) {
      error =
        "Gemini rejected the request. Check that GEMINI_API_KEY in Vercel is active and restricted to the Gemini API, then redeploy.";
    } else if (response.status === 404) {
      console.error(`[draft-petition] Gemini model "${model}" was not found or is unavailable.`);
      error =
        `Gemini model "${model}" was not found or is unavailable for this API key. ` +
        "Remove any outdated GEMINI_MODEL value from Vercel, then redeploy.";
    } else if (response.status === 429) {
      error = "Gemini's usage limit has been reached. Check your Google AI Studio quota and try again later.";
    } else if (response.status >= 500) {
      error = "Gemini is temporarily unavailable. Please try again later.";
    } else {
      error = `Gemini could not generate the draft (HTTP ${response.status}). Please check the Vercel function logs.`;
    }
    return sendJson(res, 502, {
      error,
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
