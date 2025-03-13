import { fetchCRMData } from "./monday.js";
import yaml from "js-yaml";

export const getCurrentDate = () => {
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
  let crmDataYaml = yaml.dump(crmData);

  const widths = {
    name: 20,
    company: 20,
    stage: 15,
    score: 10,
    status: 10,
    dealSize: 12,
    lastContact: 12,
    campaign: 25,
    leadsGenerated: 18,
    conversionRate: 18,
    revenueImpact: 18,
    source: 20,
    totalLeads: 15,
    qualifiedLeads: 18,
    winRate: 12,
  };

  const countryCounts = {};
  crmData.leads.forEach((lead) => {
    const country = lead.country || "Unknown";
    const oppValue = parseFloat(lead.oppValue) || 0;
    if (!countryCounts[country])
      countryCounts[country] = { total: 0, totalValuation: 0 };
    countryCounts[country].total++;
    countryCounts[country].totalValuation += oppValue;
  });

  const countryTable = Object.entries(countryCounts)
    .map(([country, { total, totalValuation }]) => {
      const formattedValuation = totalValuation
        ? `$${totalValuation.toLocaleString()}`
        : "N/A";
      return `<tr><td style="padding: 8px; text-align: left;">${country}</td><td style="padding: 8px; text-align: left;">${total}</td><td style="padding: 8px; text-align: left;">${formattedValuation}</td></tr>`;
    })
    .join("");

  const sourceCounts = {};
  crmData.leads.forEach((lead) => {
    const source = lead.sourceOfOpportunity || "Unknown";
    const oppValue = parseFloat(lead.oppValue) || 0;
    if (!sourceCounts[source]) sourceCounts[source] = { total: 0, oppValue: 0 };
    sourceCounts[source].total++;
    sourceCounts[source].oppValue += oppValue;
  });

  const campaignCounts = {};
  crmData.leads.forEach((lead) => {
    const campaign = lead.campaignName || "Unknown";
    if (!campaignCounts[campaign])
      campaignCounts[campaign] = {
        totalLeads: 0,
        conversionRate: 0,
        revenueImpact: 0,
      };
    campaignCounts[campaign].totalLeads++;
    campaignCounts[campaign].conversionRate +=
      parseFloat(lead.conversionRate) || 0;
    campaignCounts[campaign].revenueImpact +=
      parseFloat(lead.revenueImpact) || 0;
  });

  const campaignTable = Object.entries(campaignCounts)
    .map(([campaign, data]) => {
      const percentage =
        ((data.totalLeads / crmData.totalLeads) * 100).toFixed(2) + "%";
      const formattedRevenueImpact = `$${data.revenueImpact.toLocaleString()}`;
      return `<tr><td style="padding: 8px; text-align: left;">${campaign}</td><td style="padding: 8px; text-align: left;">${data.totalLeads}</td><td style="padding: 8px; text-align: left;">${percentage}</td><td style="padding: 8px; text-align: left;">${formattedRevenueImpact}</td></tr>`;
    })
    .join("");

  const detailedLeadsTable = crmData.leads
    .map(
      (lead) =>
        `<tr><td style="padding: 8px; text-align: left;">${lead.name}</td><td style="padding: 8px; text-align: left;">${lead.company}</td><td style="padding: 8px; text-align: left;">${lead.stage}</td><td style="padding: 8px; text-align: left;">${lead.score}</td><td style="padding: 8px; text-align: left;">${lead.status}</td><td style="padding: 8px; text-align: left;">${lead.oppValue}</td></tr>`
    )
    .join("");

  const totalLeads =
    crmData.totalLeads ||
    Object.values(sourceCounts).reduce((sum, s) => sum + s.total, 0);

  const leadSourceTable = Object.entries(sourceCounts)
    .map(([source, { total, oppValue }]) => {
      const percentage = ((total / totalLeads) * 100).toFixed(2) + "%";
      const formattedOppValue = oppValue
        ? `$${oppValue.toLocaleString()}`
        : "N/A";
      return `<tr><td style="padding: 8px; text-align: left;">${source}</td><td style="padding: 8px; text-align: left;">${total}</td><td style="padding: 8px; text-align: left;">${formattedOppValue}</td><td style="padding: 8px; text-align: left;">${percentage}</td></tr>`;
    })
    .join("");

  const promptExample = `
    <html>
  <head>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Roboto', sans-serif;
        color: #000;
      }
      p {
        margin: 2;
        padding: 2;
      }
      h3 {
        margin-top: 8px; /* Reduced margin */
        margin-bottom: 8px; /* Reduced margin */
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
      }
      th, td {
        padding: 4px;
        text-align: left;
        border: 1px solid #ddd;
      }
      th {
        background-color: #f2f2f2;
      }
    </style>
  </head>
  <body style="color:#000000">
  <p style="margin-bottom: 10px;">Daily Lead Summary Report -  ${todayDate} (Top 15 Deals) - [Preview Mode]</p>
  <p style="margin-bottom: 10px;">Hello,</p>
  <p style="margin-bottom: 20px;">Below is the CRM daily lead summary report to support decision-making on closing leads.</p>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Overall Pipeline Metrics</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Total Leads in Pipeline</td>
      <td>${crmData.totalLeads || "N/A"}</td>
    </tr>
  </table>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Detailed Lead Information</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Lead Name</th>
      <th>Company</th>
      <th>Stage</th>
      <th>Lead Score</th>
      <th>Status</th>
      <th>Deal Size</th>
    </tr>
    ${detailedLeadsTable}
  </table>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Breakdown by Lead Source</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Source</th>
      <th># of Leads</th>
      <th>Valuation</th>
      <th>% of Total Leads</th>
    </tr>
    ${leadSourceTable}
  </table>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Campaign Performance Table</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Campaign Name</th>
      <th>Total Leads</th>
      <th>Percentage</th>
      <th>Revenue Impact</th>
    </tr>
    ${campaignTable}
  </table>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Breakdown by Country</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Country</th>
      <th>Leads Count</th>
      <th>Total Valuation</th>
    </tr>
    ${countryTable}
  </table>

  <p style="margin-top: 10px; margin-bottom: 10px;">Thank you,</p>
  <p style="margin-bottom: 10px;">SpiderX Sales AI</p>
</body>
</html>

  `;

  return promptExample;
};
