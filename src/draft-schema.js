export const STATES_AND_TERRITORIES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const COURT_TYPES = [
  "Supreme Court of India",
  "High Court",
  "District Court",
  "Civil Court",
  "Judicial Magistrate Court",
  "Consumer Commission",
  "Tribunal",
  "Other",
];

const text = (name, label, maxLength = 150, placeholder = "") => ({
  name,
  label,
  type: "text",
  maxLength,
  placeholder,
});

const area = (name, label, maxLength, minLength = 10, placeholder = "") => ({
  name,
  label,
  type: "textarea",
  maxLength,
  minLength,
  placeholder,
});

const date = (name, label) => ({ name, label, type: "date", maxLength: 10 });

const select = (name, label, options) => ({
  name,
  label,
  type: "select",
  maxLength: Math.max(...options.map((option) => option.length)),
  options,
});

const placeFields = [
  select("stateOrTerritory", "State / Union Territory", STATES_AND_TERRITORIES),
  text("place", "City / place", 100, "For example, Jaipur"),
];

export const DOCUMENT_SCHEMAS = {
  "Basic Petition": {
    instruction:
      [
        "Draft a concise preliminary petition in the selected court/authority and place.",
        "Use the user's petition type as the title, then identify petitioner and respondent by their supplied names.",
        "Organize the document as: court heading; parties; petition title; numbered material facts in the order supplied; requested relief in a clearly labelled prayer.",
        "Do not invent a statutory basis, grounds, jurisdiction, limitation facts, citations, procedural steps, or court-specific format. Omit grounds or procedural sections not supplied rather than guessing.",
        "Do not create a case number, filing date, verification, declaration, or completed signature.",
      ].join(" "),
    fields: [
      text("petitionType", "Type / purpose of petition", 200, "For example, request to challenge a specific order"),
      ...placeFields,
      select("courtType", "Court / authority", COURT_TYPES),
      text("applicant", "Petitioner / applicant name"),
      text("respondent", "Respondent / opposite party"),
      area("facts", "Key facts (briefly, in date order)", 2500, 20),
      area("relief", "Order or relief requested", 1000, 5),
    ],
  },
  "Legal Notice (non-payment / cheque bounce)": {
    instruction:
      [
        "Draft a preliminary legal notice, not a court pleading.",
        "Use the heading 'LEGAL NOTICE'; show the supplied sender and recipient names and addresses in clearly separated sections.",
        "Organize it as: subject; numbered factual background in the order supplied; the sender's demand exactly as requested; a concise closing asking the recipient to respond to the sender.",
        "Do not invent a response deadline, payment deadline, cheque number/date, statutory section, cause of action, consequence, or claim that service or delivery has occurred.",
        "Do not add a case number, court heading, verification, declaration, or completed signature.",
      ].join(" "),
    fields: [
      text("sender", "Sender name"),
      text("senderAddress", "Sender address", 300),
      text("recipient", "Recipient name"),
      text("recipientAddress", "Recipient address", 300),
      select("noticeIssue", "Notice relates to", [
        "Unpaid dues",
        "Dishonoured cheque",
        "Other",
      ]),
      area("facts", "Relevant facts, dates, and amount if applicable", 2000, 20),
      area("demand", "What the recipient is asked to do", 800, 5),
      ...placeFields,
    ],
  },
  "Rent / Leave and Licence Agreement": {
    instruction:
      [
        "Prepare a preliminary, unsigned rental / leave-and-licence agreement from the entered terms.",
        "Use a clear title; identify the landlord/licensor and tenant/licensee; describe the property; and set out the stated start date, duration, rent, deposit, maintenance/utilities responsibility, and termination notice in separate numbered clauses.",
        "Do not calculate an end date, add a rent due date, escalation, lock-in, penalty, repair duty, renewal, deposit deduction, governing law, or dispute forum unless the user supplied that term.",
        "Do not represent that the agreement is registered, stamped, executed, or legally sufficient. Include only blank signature lines for the named parties, clearly marked for completion, and do not invent witnesses.",
        "Omit terms not provided instead of filling them with assumptions or generic placeholders.",
      ].join(" "),
    fields: [
      text("owner", "Landlord / licensor name"),
      text("occupant", "Tenant / licensee name"),
      text("propertyAddress", "Full property address", 300),
      date("startDate", "Agreement start date"),
      text("term", "Agreement duration", 100, "For example, 11 months"),
      text("monthlyRent", "Monthly rent / licence fee", 50),
      text("securityDeposit", "Security deposit", 50),
      text("maintenance", "Who pays maintenance and utilities", 300),
      text("terminationNotice", "Termination notice period", 100),
      ...placeFields,
    ],
  },
  "General Affidavit": {
    instruction:
      [
        "Prepare a simple preliminary affidavit format, not a petition or legal argument.",
        "Use the title 'AFFIDAVIT'; identify the supplied deponent and purpose; then present only the supplied facts as numbered first-person statements without changing their meaning.",
        "Do not add facts, legal conclusions, claims of personal knowledge, annexures, or dates not supplied.",
        "End with an unsigned verification section clearly marked for the deponent to review and complete before swearing. Do not state that the affidavit has been verified, signed, notarized, or sworn.",
        "Do not invent an oath officer, notary, registration number, or court case number.",
      ].join(" "),
    fields: [
      text("deponent", "Deponent name"),
      text("deponentAddress", "Deponent address", 300),
      area("purpose", "Purpose of the affidavit", 500, 5),
      area("facts", "Facts to be affirmed", 2000, 20),
      ...placeFields,
      date("statementDate", "Date of statement"),
    ],
  },
  NDA: {
    instruction:
      [
        "Prepare a concise, preliminary, unsigned non-disclosure agreement (NDA).",
        "Use a clear title; identify the disclosing and receiving parties; state the supplied purpose, description of confidential information, confidentiality duration, and effective date as separate clauses.",
        "Do not assume the agreement is mutual, add permitted-use or disclosure exceptions, ownership transfer, return/destruction duties, penalties, remedies, renewal, governing law, or dispute forum unless provided.",
        "Do not claim the parties have signed or accepted the NDA. Include only blank signature lines for the named parties, clearly marked for completion.",
        "Omit unprovided terms rather than guessing or adding generic placeholders.",
      ].join(" "),
    fields: [
      text("disclosingParty", "Disclosing party"),
      text("receivingParty", "Receiving party"),
      area("purpose", "Purpose of sharing information", 500, 5),
      area("confidentialInformation", "Information to be kept confidential", 1000, 10),
      text("duration", "Confidentiality period", 100),
      date("effectiveDate", "Effective date"),
      ...placeFields,
    ],
  },
  "Consumer Complaint": {
    instruction:
      [
        "Write a clean, preliminary Indian consumer complaint using only the supplied facts.",
        "Format it with a heading naming the selected commission level only if the user selected District, State, or National; if the user selected 'Not sure', use the neutral 'Consumer Disputes Redressal Commission' heading and mention only the city/place entered in the form. Do not decide pecuniary or territorial jurisdiction.",
        "Identify the complainant and opposite party by their entered names and addresses. Never substitute an address for a party name or describe a city as the opposite party.",
        "Use a short subject, numbered facts, and a clearly labelled relief section that accurately repeats the relief requested. The purchase price is not automatically the compensation requested.",
        "Do not invent a complaint number, filing date, cause of action date, legal grounds, statutory sections, evidence, prior steps, verification, declaration, signature, or facts.",
        "Omit registry-assigned or unprovided details rather than filling the draft with [PLACEHOLDER] labels. Do not include an empty address line. Do not say the complainant verifies or declares facts unless explicitly supplied.",
        "Do not present the draft as filing-ready or state that the selected commission is legally appropriate.",
      ].join(" "),
    fields: [
      text("complainant", "Complainant name"),
      text("complainantAddress", "Complainant address", 300),
      text("business", "Seller / service provider name"),
      text("businessAddress", "Seller / service provider address", 300),
      select("commissionLevel", "Consumer Commission level", [
        "District Commission",
        "State Commission",
        "National Commission",
        "Not sure",
      ]),
      text("productOrService", "Product or service", 200),
      date("purchaseDate", "Purchase / service date"),
      text("amountPaid", "Purchase price / amount paid", 50),
      area("facts", "What happened and steps already taken", 2000, 20),
      area("relief", "Specific order or resolution requested", 800, 5),
      ...placeFields,
    ],
  },
  "RTI Application": {
    instruction:
      [
        "Draft a concise application requesting information from the public authority; do not draft an appeal or consumer complaint.",
        "Use the title 'APPLICATION UNDER THE RIGHT TO INFORMATION ACT'; address it to the supplied public authority; identify the applicant using the supplied name and postal address.",
        "List the requested records/information as numbered, specific points. Include the relevant period only if supplied and state the requested response format.",
        "Do not invent an officer's name, fee payment, applicant category, exemption analysis, response deadline, statutory section, or claim that the application was filed.",
        "Do not add a declaration, verification, or completed signature. Omit unprovided administrative details rather than guessing.",
      ].join(" "),
    fields: [
      text("applicant", "Applicant name"),
      text("applicantAddress", "Applicant postal address", 300),
      text("publicAuthority", "Public authority / department"),
      area("informationRequested", "Specific information or records requested", 1500, 10),
      text("timePeriod", "Relevant period, if any", 100),
      select("responseFormat", "Preferred response format", [
        "Copies of records",
        "Inspection of records",
        "Electronic copies",
        "Other",
      ]),
      ...placeFields,
    ],
  },
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_SCHEMAS);
