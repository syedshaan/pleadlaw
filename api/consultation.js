const ALLOWED_SERVICES = new Set([
  "Career Counselling",
  "CV Building & Review",
  "Legal Consultation",
  "Legal Research & Drafting",
]);
const ALLOWED_CONTACT_METHODS = new Set(["Email", "WhatsApp"]);

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

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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
    return sendJson(res, 413, { error: "The submitted form is too large." });
  }

  const data = getRequestData(req);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return sendJson(res, 400, { error: "Please submit a valid form." });
  }
  if (cleanText(data.website, 200)) {
    return sendJson(res, 200, { ok: true });
  }

  const name = cleanText(data.name, 100);
  const age = Number(data.age);
  const region = cleanText(data.region, 120);
  const mobile = cleanText(data.mobile, 20).replace(/[()\s-]/g, "");
  const email = cleanText(data.email, 254);
  const serviceType = cleanText(data.serviceType, 80);
  const query = cleanText(data.query, 5000);
  const commPref = cleanText(data.commPref, 20);
  const phoneIsValid = /^(?:\+?91)?[6-9]\d{9}$/.test(mobile);

  if (
    data.consent !== true ||
    !name ||
    !Number.isInteger(age) ||
    age < 1 ||
    age > 120 ||
    !region ||
    !phoneIsValid ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !ALLOWED_SERVICES.has(serviceType) ||
    query.length < 10 ||
    !ALLOWED_CONTACT_METHODS.has(commPref)
  ) {
    return sendJson(res, 400, {
      error: "Please check the required fields and try again.",
    });
  }

  const { OWNER_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
  if (!OWNER_EMAIL || !RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    console.error("[consultation] Email service environment is not configured.");
    return sendJson(res, 503, {
      error: "The request service is not configured yet. Please try again later.",
    });
  }

  const message = [
    "New consultation request from Pleadlaw",
    "",
    `Name: ${name}`,
    `Age: ${age}`,
    `City / State: ${region}`,
    `Mobile: ${mobile}`,
    `Email: ${email}`,
    `Service: ${serviceType}`,
    `Preferred contact method: ${commPref}`,
    "",
    "How can we help?",
    query,
  ].join("\n");

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [OWNER_EMAIL],
        reply_to: email,
        subject: `Pleadlaw consultation request - ${name}`,
        text: message,
      }),
    });
  } catch (error) {
    console.error(
      "[consultation] Email provider request failed:",
      error instanceof Error ? error.message : "Unknown network error"
    );
    return sendJson(res, 502, {
      error: "We could not send your request right now. Please try again later.",
    });
  }

  if (!response.ok) {
    console.error(
      `[consultation] Email provider returned HTTP ${response.status}.`
    );
    return sendJson(res, 502, {
      error: "We could not send your request right now. Please try again later.",
    });
  }

  return sendJson(res, 200, { ok: true });
}
