import { fetchCRMData } from "./monday.js";

const getCurrentDate = () => {
  const now = new Date();
  return now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const generatePrompt = async () => {
  const crmData = await fetchCRMData();
  const todayDate = getCurrentDate();
//   console.log(JSON.stringify(crmData, null, 2));
console.log("Length",crmData.length);

  const opportunityValues = crmData.map(deal => {
    const oppValueField = deal.column_values.find(col => col.id === "numeric_mknx4ka9");
    return oppValueField ? oppValueField.text : null; // Returns the opportunity value or null if not found
  });
  
  
  const promptExample = `Act as a high-level sales insights assistant. Using the provided CRM data and metrics, generate a detailed Daily Lead Summary email designed for executive decision-making. 

**Subject:** "Daily Lead Summary – Report ${todayDate}"

**Instructions:**
The email should include the following sections and placeholders:

**Overall Pipeline Metrics Section:**
A table that lists metrics such as:
- Total Leads in Pipeline: [Total Count]
- Qualified Leads: [Qualified Count]

**Detailed Lead Information Section:**
A table with columns:
Lead Name | Company | Stage | Lead Score | Deal Value | Last Contact | Next Steps | Comments

**Breakdown by Lead Source Section:**
A table with columns:
Source | # of Leads | Qualified Leads | % of Total Leads

**Breakdown by Campaign Section:**
A table with columns:
Campaign Name | # of Leads | Qualified Leads | Conversion Rate

**Breakdown by Country Section:**
A table with columns:
Country | # of Leads | Qualified Leads | % of Total Leads

**AI Analysis & Insights Section:**
A table for individual leads with columns:
Lead Name | AI Score | Predicted Closure Probability | Key Observations

**Recommended Actions Section:**
- High-Probability Leads (e.g., Lead A): Expedite negotiations and schedule a closing call.
- Moderate-Probability Leads (e.g., Lead B): Increase personalized follow-ups.
- General recommendations: Revisit underperforming segments.

**Summary & Closing:**
Summarize prioritized leads for immediate closure.
End with: "Thank you, SpiderX Sales AI".

---

${JSON.stringify(crmData, null, 2)}
`;

  return promptExample;
};
