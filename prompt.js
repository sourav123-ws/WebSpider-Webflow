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
        ? totalValuation.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "N/A";
      return `<tr><td style="padding: 8px; text-align: left;">${country}</td>
              <td style="padding: 8px; text-align: left;">${total}</td>
              <td style="padding: 8px; text-align: left;">${formattedValuation}</td></tr>`;
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
    console.log("Lead",lead);
    const campaign = lead.campaignName || "Unknown";
    if (!campaignCounts[campaign])
      campaignCounts[campaign] = {
        totalLeads: 0,
        conversionRate: 0,
        oppValue: 0
      };
    campaignCounts[campaign].totalLeads++;
    campaignCounts[campaign].conversionRate +=
      parseFloat(lead.conversionRate) || 0;
    campaignCounts[campaign].oppValue +=
      parseFloat(lead.oppValue) || 0;
  });

  const campaignTable = Object.entries(campaignCounts)
  .map(([campaign, data]) => {
    console.log("Data", data);
    const percentage =
      ((data.totalLeads / crmData.totalLeads) * 100).toFixed(2) + "%";

    // Ensure data.totalLeads and data.oppValue are numbers
    const totalLeads = Number(data.totalLeads) || 0;
    const revenueImpact = Number(data.oppValue) || 0;

    // Format totalLeads with comma and .00
    const formattedTotalLeads = totalLeads.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Format revenue impact with comma and .00
    const formattedRevenueImpact = revenueImpact.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `<tr>
      <td style="padding: 8px; text-align: left;">${campaign}</td>
      <td style="padding: 8px; text-align: left;">${formattedTotalLeads}</td>
      <td style="padding: 8px; text-align: left;">${percentage}</td>
      <td style="padding: 8px; text-align: left;">${formattedRevenueImpact}</td>
    </tr>`;
  })
  .join("");



    const formatDealSize = (dealSize) => {
      if (!dealSize || isNaN(dealSize)) return "N/A";
      return parseFloat(dealSize).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  };

  const totalDealSize = crmData.leads.reduce(
    (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
    0
  );
  const formattedTotalDealSize = `$${totalDealSize.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const detailedLeadsTable = crmData.leads
    .map(
      (lead) =>
        `<tr><td style="padding: 8px; text-align: left;">${
          lead.name
        }</td><td style="padding: 8px; text-align: left;">${
          lead.company
        }</td><td style="padding: 8px; text-align: left;">${
          lead.stage
        }</td><td style="padding: 8px; text-align: left;">${
          lead.score
        }</td><td style="padding: 8px; text-align: left;">${
          lead.status
        }</td><td style="padding: 8px; text-align: left;">${formatDealSize(
          lead.oppValue
        )}</td></tr>`
    )
    .join("");

  const totalLeads =
    crmData.totalLeads ||
    Object.values(sourceCounts).reduce((sum, s) => sum + s.total, 0);

    const leadSourceTable = Object.entries(sourceCounts)
    .map(([source, { total, oppValue }]) => {
      const percentage = ((total / totalLeads) * 100).toFixed(2) + "%";
      const formattedOppValue = oppValue
        ? parseFloat(oppValue).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "N/A";

      return `<tr><td style="padding: 8px; text-align: left;">${source}</td>
              <td style="padding: 8px; text-align: left;">${total}</td>
              <td style="padding: 8px; text-align: left;">${percentage}</td>
              <td style="padding: 8px; text-align: left;">${formattedOppValue}</td></tr>`;
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
  <p style="margin-bottom: 10px;">Daily Lead Summary Report -  ${todayDate} (Top 25 Deals) - [Preview Mode]</p>
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
      <th>Deal Size($)</th>
    </tr>
    ${detailedLeadsTable}
  </table>
  <table style="margin-top: -1px; border-collapse: collapse; width: 30%; margin-left: auto; background-color: black; color: white;" border="1">
    <tr>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 70%;">Total Deal Size</td>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 30%;">${formattedTotalDealSize}</td>
    </tr>
</table>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Breakdown by Lead Source</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Source</th>
      <th>Total Leads</th>
      <th>Leads(%)</th>
      <th>Total Deal Size($)</th>
    </tr>
    ${leadSourceTable}
  </table>
  <table style="margin-top: -1px; border-collapse: collapse; width: 30%; margin-left: auto; background-color: black; color: white;" border="1">
    <tr>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 70%;">Total Deal Size</td>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 30%;">${formattedTotalDealSize}</td>
    </tr>
</table> 


  <h3 style="margin-top: 20px; margin-bottom: 10px;">Campaign Performance Table</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Campaign Name</th>
      <th>Total Leads</th>
      <th>Percentage</th>
      <th>Total Deal Size($)</th>
    </tr>
    ${campaignTable}
  </table>
  <table style="margin-top: -1px; border-collapse: collapse; width: 30%; margin-left: auto; background-color: black; color: white;" border="1">
    <tr>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 70%;">Total Deal Size</td>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 30%;">${formattedTotalDealSize}</td>
    </tr>
</table>

  <h3 style="margin-top: 20px; margin-bottom: 10px;">Breakdown by Country</h3>
  <table style="margin-bottom: 20px;">
    <tr>
      <th>Country</th>
      <th>Leads Count</th>
      <th>Total Deal Size($)</th>
    </tr>
    ${countryTable}
  </table>
  <table style="margin-top: -1px; border-collapse: collapse; width: 30%; margin-left: auto; background-color: black; color: white;" border="1">
    <tr>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 70%;">Total Deal Size</td>
      <td style="border: 1px solid white; padding: 8px; font-weight: bold; width: 30%;">${formattedTotalDealSize}</td>
    </tr>
</table>

  <h3 style="margin-top: 10px; margin-bottom: 10px;">Lead Score Classification</h3>
<table style="margin-bottom: 10px; border-collapse: collapse; width: 20%;" border="1">
  <tr>
    <th style="border: 1px solid black; padding: 8px;">Score Range</th>
    <th style="border: 1px solid black; padding: 8px;">Classification</th>
  </tr>
  <tr>
    <td style="border: 1px solid black; padding: 8px;">0 - 19</td>
    <td style="border: 1px solid black; padding: 8px;">Cold</td>
  </tr>
  <tr>
    <td style="border: 1px solid black; padding: 8px;">20 - 79</td>
    <td style="border: 1px solid black; padding: 8px;">Warm</td>
  </tr>
  <tr>
    <td style="border: 1px solid black; padding: 8px;">80 - 100</td>
    <td style="border: 1px solid black; padding: 8px;">Hot</td>
  </tr>
</table>

  <p style="margin-top: 10px; margin-bottom: 10px;">Thank you,</p>
  <p style="margin-bottom: 10px;">SpiderX Sales AI</p>
</body>
</html>

  `;

  return promptExample;
};
