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
      "Draft a concise petition structure. Do not assume the petition type, statutory basis, or court-specific procedure if the user did not provide it.",
    fields: [
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
      "Draft a preliminary legal notice using the supplied sender, recipient, issue, facts, and demand. Do not invent statutory deadlines or assert that a notice is legally sufficient.",
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
      "Prepare a preliminary rental or leave-and-licence agreement using only the entered terms. Do not assume statutory requirements or invent clauses inconsistent with the supplied terms.",
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
      "Draft a simple affidavit format from the deponent's supplied statement. Do not add facts or claim notarization or execution has occurred.",
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
      "Prepare a preliminary NDA using the supplied commercial terms. Do not assume exclusivity, ownership, remedies, or statutory requirements that were not supplied.",
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
      "Prepare a preliminary consumer complaint format. Use only supplied purchase, service, and grievance details; do not decide legal jurisdiction or invent statutory citations.",
    fields: [
      text("complainant", "Complainant name"),
      text("business", "Seller / service provider name"),
      text("businessAddress", "Seller / service provider address", 300),
      text("productOrService", "Product or service", 200),
      date("purchaseDate", "Purchase / service date"),
      text("amountPaid", "Amount paid, if any", 50),
      area("facts", "What happened and steps already taken", 2000, 20),
      area("relief", "Resolution or compensation requested", 800, 5),
      ...placeFields,
    ],
  },
  "RTI Application": {
    instruction:
      "Draft a concise RTI application requesting records or information. Do not provide legal conclusions or claim a response deadline beyond what the user supplied.",
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
