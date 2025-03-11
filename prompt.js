import { fetchCRMData } from "./monday.js";
import yaml from "js-yaml";

// export const getCurrentDate = () => {
//   const now = new Date();
//   return now.toLocaleDateString("en-GB", {
//     day: "numeric",
//     month: "long",
//     year: "numeric",
//   });
// };

// export const generatePrompt = async () => {
//   const crmData = await fetchCRMData();
//   const todayDate = getCurrentDate();
//   //   console.log(JSON.stringify(crmData, null, 2));
//   console.log("Length", crmData.length);

//   const opportunityValues = crmData.map((deal) => {
//     const oppValueField = deal.column_values.find(
//       (col) => col.id === "numeric_mknx4ka9"
//     );
//     return oppValueField ? oppValueField.text : null;
//   });

//   const promptExample = `Act as a high-level sales insights assistant. Using the provided CRM data and metrics, generate a detailed Daily Lead Summary email designed for executive decision-making.

// **Subject:** "Daily Lead Summary – Report ${todayDate}"

// **Instructions:**
// The email should include the following sections and placeholders:

// HTML Table
// **Overall Pipeline Metrics Section:**
// A table that lists metrics such as:
// - Total Leads in Pipeline: [Total Count]
// - Qualified Leads: [Qualified Count]

// HTML Table
// **Detailed Lead Information Section:**
// A table with columns:
// Lead Name | Company | Stage | Lead Score | Deal Value | Last Contact | Next Steps | Comments

// HTML Table
// **Breakdown by Lead Source Section:**
// A table with columns:
// Source | # of Leads | Qualified Leads | % of Total Leads

// ---

// ${JSON.stringify(crmData, null, 2)}
// `;

//   return promptExample;
// };

// import { fetchCRMData } from "./monday.js";
// import yaml from "js-yaml"; // Ensure you install this: npm install js-yaml

// export const getCurrentDate = () => {
//   const now = new Date();
//   return now.toLocaleDateString("en-GB", {
//     day: "numeric",
//     month: "long",
//     year: "numeric",
//   });
// };

// export const generatePrompt = async () => {
//   const crmData = await fetchCRMData();
//   const todayDate = getCurrentDate();

//   console.log("Length", crmData.length);

//   // Convert crmData to YAML format
//   const crmDataYaml = yaml.dump(crmData, { indent: 2 });
//   console.log("CRM Data in YAML format:\n", crmDataYaml);

//   const promptExample = `
// Subject: Daily Lead Summary – Report ${todayDate}

// Hello [Executive Name],

// Below is your CRM daily lead summary report to support decision-making on closing leads.

// Overall Pipeline Metrics
// Metric                         | Value
// -------------------------------|----------------
// Total Leads in Pipeline        | [Total Count]
// Qualified Leads                | [Qualified Count]

// Detailed Lead Information
// Lead Name   | Company      | Stage           | Lead Score | Deal Size   | Last Contact  | Next Steps                         | Comments
// ------------|--------------|-----------------|------------|-------------|---------------|------------------------------------|-----------------------------------------
// Lead A      | [Company A]  | Proposal Sent   | [Score]    | [$ Amount]  | [MM/DD/YYYY]  | Follow-up scheduled [Date]         | High engagement; positive client feedback
// Lead B      | [Company B]  | Needs Analysis  | [Score]    | [$ Amount]  | [MM/DD/YYYY]  | Further qualification needed       | Moderate interest; potential for growth

// (Add additional rows as needed)

// Breakdown by Lead Source
// Source         | # of Leads | Qualified Leads   | % of Total Leads
// ---------------|------------|-------------------|-------------------
// Website        | [Count]    | [Qualified Count] | [Percentage]%
// Social Media   | [Count]    | [Qualified Count] | [Percentage]%
// Referral       | [Count]    | [Qualified Count] | [Percentage]%
// Email Campaigns| [Count]    | [Qualified Count] | [Percentage]%
// Other          | [Count]    | [Qualified Count] | [Percentage]%

// Breakdown by Campaign
// Campaign Name | # of Leads | Qualified Leads   | Conversion Rate
// --------------|------------|-------------------|-------------------
// Campaign A    | [Count]    | [Qualified Count] | [Conversion %]
// Campaign B    | [Count]    | [Qualified Count] | [Conversion %]
// Campaign C    | [Count]    | [Qualified Count] | [Conversion %]

// Breakdown by Country
// Country         | # of Leads | Qualified Leads   | % of Total Leads
// ----------------|------------|-------------------|-------------------
// United States   | [Count]    | [Qualified Count] | [Percentage]%
// United Kingdom  | [Count]    | [Qualified Count] | [Percentage]%
// Germany         | [Count]    | [Qualified Count] | [Percentage]%
// India           | [Count]    | [Qualified Count] | [Percentage]%
// Other           | [Count]    | [Qualified Count] | [Percentage]%

// AI Analysis & Insights
// Our AI-powered analysis of the CRM data has provided the following insights:

// Lead Name   | AI Score  | Predicted Closure Probability | Key Observations
// ------------|-----------|-------------------------------|----------------------------------
// Lead A      | [Score]   | [Probability %]               | High engagement; quick follow-up responses
// Lead B      | [Score]   | [Probability %]               | Moderate engagement; needs more nurturing

// Additional AI Observations:
// Overall Trends:
// - A significant proportion of leads from [Top Source] are showing higher engagement levels.
// - Campaigns with targeted messaging are outperforming broader outreach initiatives.

// Predictive Insights:
// - Leads with an AI Score above [Threshold] have a significantly higher likelihood of closure.
// - Lower-scoring leads might benefit from additional engagement before a final decision.

// Recommended Actions
// Based on both traditional metrics and AI analysis, we recommend the following actions:

// For High-Probability Leads (e.g., Lead A):
// - Expedite the final negotiation steps.
// - Schedule a closing call or demo as soon as possible.

// For Moderate-Probability Leads (e.g., Lead B):
// - Increase personalized follow-ups and engagement.
// - Re-assess after an additional round of qualification.

// General Actions:
// - Revisit underperforming segments (by source or campaign) and adjust strategies.
// - Consider reallocating resources to campaigns showing higher conversion rates.
// - Monitor leads with declining engagement closely and intervene with targeted outreach.

// Summary
// Based on the overall metrics, detailed lead breakdowns, AI insights, and recommended actions, the following leads are prioritized for immediate closure:
// [List of leads recommended for closure]

// Thank you,
// SpiderX Sales AI

// CRM Data for Reference:

// \`\`\`yaml
// ${crmDataYaml}
// \`\`\`
// `;

//   return promptExample;
// };

export const getCurrentDate = () => {
  const now = new Date();
  return now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// Helper function to format text and ensure proper spacing
const formatCell = (text, width, isCompany = false) => {
  if (!text) return "N/A".padEnd(width, " ");

  // Normalize to prevent encoding issues
  text = text.normalize("NFC").trim();

  console.log(`Formatting: ${text} | IsCompany: ${isCompany} | Length: ${text.length}`);

  // Trim only if it's a company name
  if (isCompany && text.length > 20) {
    return text.slice(0, 20) + "...";
  }

  // Ensure consistent padding
  return text.padEnd(width, " ");
};



export const generatePrompt = async () => {
  const crmData = await fetchCRMData();
  const todayDate = getCurrentDate();
  let crmDataYaml = yaml.dump(crmData);

  // Define column widths
  const widths = {
    name: 20,
    company: 20,
    stage: 15,
    score: 10,
    status: 10,
    dealSize: 12,
    lastContact: 12,
  };

  // Format Detailed Lead Information
  const detailedLeadsTable = crmData.leads
  .map(
    (lead) =>
      `${formatCell(lead.name, widths.name)} | ${formatCell(
        lead.company,
        widths.company,
        true 
      )} | ${formatCell(lead.stage, widths.stage)} | ${formatCell(
        lead.score,
        widths.score
      )} | ${formatCell(lead.status, widths.status)} | ${formatCell(
        lead.dealSize,
        widths.dealSize
      )} | ${formatCell(lead.lastContact, widths.lastContact)} |`
  )
  .join("\n");


  const promptExample = `
Subject: Daily Lead Summary – Report ${todayDate}

Hello [Executive Name],

Below is your CRM daily lead summary report to support decision-making on closing leads.

Overall Pipeline Metrics  
Metric                         | Value  
-------------------------------|----------------  
Total Leads in Pipeline        | ${crmData.totalLeads || "N/A"}  
Qualified Leads                | ${crmData.qualifiedLeads || "N/A"}  

Detailed Lead Information  
${formatCell("Lead Name", widths.name)} | ${formatCell(
    "Company",
    widths.company
  )} | ${formatCell("Stage", widths.stage)} | ${formatCell(
    "Lead Score",
    widths.score
  )} | ${formatCell("Status", widths.status)} | ${formatCell(
    "Deal Size",
    widths.dealSize
  )} |
${"-".repeat(widths.name)} | ${"-".repeat(widths.company)} | ${"-".repeat(
    widths.stage
  )} | ${"-".repeat(widths.score)} | ${"-".repeat(widths.dealSize)} |  
${detailedLeadsTable}


Thank you,  
SpiderX Sales AI

CRM Data for Reference:

\`\`\`yaml
${crmDataYaml}
\`\`\`
`;

  return promptExample;
};
