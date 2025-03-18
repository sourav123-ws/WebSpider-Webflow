import { fetchCRMData, fetchLatestLeadsByDate } from "./monday.js";
import yaml from "js-yaml";

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

export const getCurrentDate = () => {
  const now = new Date();
  return now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const fetchLatestCommentsForLeads = async (leadIds) => {
  try {
    // Ensure leadIds is an array
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      throw new Error("Invalid leadIds: Must be a non-empty array");
    }

    // Construct GraphQL query for multiple leads
    const query = `
      query {
        items(ids: [${leadIds.join(",")}]) {
          id
          updates(limit: 1) {
            text_body
            created_at
          }
        }
      }
    `;

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MONDAY_API_KEY}`, // Ensure API Key is set
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    // Validate response structure
    const items = data?.data?.items || [];
    if (items.length === 0) {
      return leadIds.map((id) => ({
        leadId: id,
        comment: "No recent activity",
        activityDate: "N/A",
      }));
    }

    // Process results
    return items.map((item) => ({
      leadId: item.id,
      comment: item.updates?.[0]?.text_body || "No comment content",
      activityDate: item.updates?.[0]?.created_at || "N/A",
    }));
  } catch (error) {
    console.error(`Error fetching comments for leads:`, error);
    return leadIds.map((id) => ({
      leadId: id,
      comment: "Error fetching comment",
      activityDate: "N/A",
    }));
  }
};

export const generatePrompt = async () => {
  const crmData = await fetchCRMData();
  const todayDate = getCurrentDate();
  let crmDataYaml = yaml.dump(crmData);

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
    console.log("Lead", lead);
    const campaign = lead.campaignName || "Unknown";
    if (!campaignCounts[campaign])
      campaignCounts[campaign] = {
        totalLeads: 0,
        conversionRate: 0,
        oppValue: 0,
      };
    campaignCounts[campaign].totalLeads++;
    campaignCounts[campaign].conversionRate +=
      parseFloat(lead.conversionRate) || 0;
    campaignCounts[campaign].oppValue += parseFloat(lead.oppValue) || 0;
  });

  const campaignTable = Object.entries(campaignCounts)
    .map(([campaign, data]) => {
      const percentage =
        ((data.totalLeads / crmData.totalLeads) * 100).toFixed(2) + "%";

      const totalLeads = Number(data.totalLeads) || 0;
      const revenueImpact = Number(data.oppValue) || 0;

      const formattedTotalLeads = totalLeads.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

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
  console.log("CRM LEADS", crmData);
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
      color: #333;
      background-color: #f8f9fa;
      padding: 20px;
    }
    h3 {
      margin-top: 20px;
      margin-bottom: 10px;
      color: #007bff;
      font-weight: 700;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #007bff;
      color: white;
      text-transform: uppercase;
    }
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    .summary-table {
      width: 40%;
      margin-left: auto;
      background-color: #343a40;
      color: white;
    }
    .summary-table td {
      border: 1px solid white;
      padding: 10px;
      font-weight: bold;
    }
    p {
      margin-bottom: 10px;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <p>Hello,</p>
  <p>Below is the CRM daily lead summary report to support decision-making on closing leads.</p>

  <h3>Overall Pipeline Metrics</h3>
  <table>
    <tr>
      <th>Metric</th>
      <th>Value</th>
    </tr>
    <tr>
      <td>Total Leads in Pipeline</td>
      <td>${crmData.totalLeads || "N/A"}</td>
    </tr>
  </table>

  <h3>Detailed Lead Information</h3>
  <table>
    <tr>
      <th>Lead Name</th>
      <th>Company</th>
      <th>Stage</th>
      <th>Lead Score</th>
      <th>Status</th>
      <th>Deal Size ($)</th>
    </tr>
    ${detailedLeadsTable}
  </table>
  <table class="summary-table">
    <tr>
      <td>Total Deal Size</td>
      <td>${formattedTotalDealSize}</td>
    </tr>
  </table>

  <h3>Breakdown by Lead Source</h3>
  <table>
    <tr>
      <th>Source</th>
      <th>Total Leads</th>
      <th>Leads (%)</th>
      <th>Total Deal Size ($)</th>
    </tr>
    ${leadSourceTable}
  </table>
  <table class="summary-table">
    <tr>
      <td>Total Deal Size</td>
      <td>${formattedTotalDealSize}</td>
    </tr>
  </table>
  
  <h3>Campaign Performance Table</h3>
  <table>
    <tr>
      <th>Campaign Name</th>
      <th>Total Leads</th>
      <th>Percentage</th>
      <th>Total Deal Size ($)</th>
    </tr>
    ${campaignTable}
  </table>
  <table class="summary-table">
    <tr>
      <td>Total Deal Size</td>
      <td>${formattedTotalDealSize}</td>
    </tr>
  </table>

  <h3>Breakdown by Country</h3>
  <table>
    <tr>
      <th>Country</th>
      <th>Leads Count</th>
      <th>Total Deal Size ($)</th>
    </tr>
    ${countryTable}
  </table>
  <table class="summary-table">
    <tr>
      <td>Total Deal Size</td>
      <td>${formattedTotalDealSize}</td>
    </tr>
  </table>

  <h3>Lead Score Classification</h3>
  <table style="width: 30%;">
    <tr>
      <th>Score Range</th>
      <th>Classification</th>
    </tr>
    <tr>
      <td>0 - 19</td>
      <td>Cold</td>
    </tr>
    <tr>
      <td>20 - 79</td>
      <td>Warm</td>
    </tr>
    <tr>
      <td>80 - 100</td>
      <td>Hot</td>
    </tr>
  </table>

  <p>Thank you,</p>
  <p>SpiderX Sales AI</p>
</body>
</html>

  `;

  return promptExample;
};

export const generatePromptDateWise = async () => {
  const crmData = await fetchLatestLeadsByDate();
  const todayDate = getCurrentDate();

  const leadsWithComments = await Promise.all(
    crmData.leads.map(async (lead) => {
      return {
        date: lead.date ? lead.date.split("T")[0] : "Unknown",
        campaignName: lead.campaignName || "N/A",
        campaignId : lead.campaignId || "N/A",
        leadName: lead.fullName || "N/A",
        status: lead.status || "N/A",
        stage: lead.stage || "N/A",
        comment: lead.comment || "N/A",
      };
    })
  );

  // Group leads by date
  const dateGroups = {};
  leadsWithComments.forEach((lead) => {
    if (!dateGroups[lead.date]) {
      dateGroups[lead.date] = [];
    }
    dateGroups[lead.date].push(lead);
  });
  // Generate Date-wise Table Rows
  const dateTable = Object.entries(dateGroups)
    .map(([date, leads]) =>
      leads
        .map(
          (lead, index) => `
        <tr>
          ${
            index === 0
              ? `<td rowspan="${leads.length}" style="padding: 8px; text-align: left;">${date}</td>`
              : ""
          }
          <td style="padding: 8px; text-align: left;">${lead.campaignName} (${lead.campaignId})</td>
          <td style="padding: 8px; text-align: left;">${lead.leadName}</td>
          <td style="padding: 8px; text-align: left;">${lead.status}</td>
          <td style="padding: 8px; text-align: left;" class="${
            lead.stage.toLowerCase() === "cold"
              ? "cold"
              : lead.stage.toLowerCase() === "warm"
              ? "warm"
              : lead.stage.toLowerCase() === "hot"
              ? "hot"
              : ""
          }">${lead.stage}</td>
          <td style="padding: 8px; text-align: left;">${lead.comment}</td>
        </tr>`
        )
        .join("")
    )
    .join("");

  // Construct HTML
  const emailHtml = `
    <html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Roboto', sans-serif; color: #333; background-color: #f8f9fa; padding: 20px; }
    .container { max-width: 900px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); }
    h3 { color: #007bff; margin-bottom: 10px; }
    p { margin: 10px 0; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #fff; }
    th, td { padding: 12px; text-align: left; border: 1px solid #ddd; font-size: 14px; }
    th { background-color: #007bff; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .cold { background-color: #007bff; color: white; } /* Blue for Cold */
    .warm { background-color: #ff9800; color: white; } /* Amber for Warm */
    .hot { background-color: #f44336; color: white; } /* Red for Hot */
  </style>
</head>
<body>
  <div class="container">
    <h3>Breakdown by Date</h3>
    <table>
      <tr>
        <th>Date</th>
        <th>Campaign Name(Campaign ID)</th>
        <th>Lead Name</th>
        <th>Status</th>
        <th>Stage</th>
        <th>Comment (Activity)</th>
      </tr>
      ${dateTable}
    </table>

    <p>Thank you,</p>
    <p><strong>SpiderX Sales AI</strong></p>
  </div>
</body>
</html>

  `;

  return emailHtml;
};


// export const generatePrompt = async () => {
//   const crmData = await fetchCRMData();
//   const todayDate = getCurrentDate();
//   let crmDataYaml = yaml.dump(crmData);

//   const campaignCounts = {};
//   crmData.leads.forEach((lead) => {
//     console.log("Lead", lead);
//     const campaign = lead.campaignName || "Unknown";
//     if (!campaignCounts[campaign])
//       campaignCounts[campaign] = {
//         totalLeads: 0,
//         conversionRate: 0,
//         oppValue: 0,
//       };
//     campaignCounts[campaign].totalLeads++;
//     campaignCounts[campaign].conversionRate +=
//       parseFloat(lead.conversionRate) || 0;
//     campaignCounts[campaign].oppValue += parseFloat(lead.oppValue) || 0;
//   });

//     const campaignTable = Object.entries(campaignCounts)
//     .map(([campaign, data]) => {
//       const percentage =
//         ((data.totalLeads / crmData.totalLeads) * 100).toFixed(2) + "%";

//       const totalLeads = Number(data.totalLeads) || 0;
//       const revenueImpact = Number(data.oppValue) || 0;

//       const formattedTotalLeads = totalLeads.toLocaleString("en-US", {
//         minimumFractionDigits: 2,
//         maximumFractionDigits: 2,
//       });

//   const sourceCounts = {};
//   crmData.leads.forEach((lead) => {
//     const source = lead.sourceOfOpportunity || "Unknown";
//     const oppValue = parseFloat(lead.oppValue) || 0;
//     if (!sourceCounts[source]) sourceCounts[source] = { total: 0, oppValue: 0 };
//     sourceCounts[source].total++;
//     sourceCounts[source].oppValue += oppValue;
//   });

//   const campaignCounts = {};
//   crmData.leads.forEach((lead) => {
//     console.log("Lead", lead);
//     const campaign = lead.campaignName || "Unknown";
//     if (!campaignCounts[campaign])
//       campaignCounts[campaign] = {
//         totalLeads: 0,
//         conversionRate: 0,
//         oppValue: 0,
//       };
//     campaignCounts[campaign].totalLeads++;
//     campaignCounts[campaign].conversionRate +=
//       parseFloat(lead.conversionRate) || 0;
//     campaignCounts[campaign].oppValue += parseFloat(lead.oppValue) || 0;
//   });

//   const leadSourceTable = Object.entries(sourceCounts)
//     .map(([source, { total, oppValue }]) => {
//       const percentage = ((total / totalLeads) * 100).toFixed(2) + "%";
//       const formattedOppValue = oppValue
//         ? parseFloat(oppValue).toLocaleString("en-US", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })
//         : "N/A";

//       return `<tr><td style="padding: 8px; text-align: left;">${source}</td>
//               <td style="padding: 8px; text-align: left;">${total}</td>
//               <td style="padding: 8px; text-align: left;">${percentage}</td>
//               <td style="padding: 8px; text-align: left;">${formattedOppValue}</td></tr>`;
//     })
//     .join("");

//   const countryCounts = {};
//   crmData.leads.forEach((lead) => {
//     const country = lead.country || "Unknown";
//     const oppValue = parseFloat(lead.oppValue) || 0;
//     if (!countryCounts[country])
//       countryCounts[country] = { total: 0, totalValuation: 0 };
//     countryCounts[country].total++;
//     countryCounts[country].totalValuation += oppValue;
//   });

//   const countryTable = Object.entries(countryCounts)
//     .map(([country, { total, totalValuation }]) => {
//       const formattedValuation = totalValuation
//         ? totalValuation.toLocaleString("en-US", {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//           })
//         : "N/A";
//       return `<tr><td>${country}</td><td>${total}</td><td>${formattedValuation}</td></tr>`;
//     })
//     .join("");

//   const statusColors = {
//     "Cold": "#007bff",   // Blue
//     "Warm": "#ffbf00",   // Amber
//     "Hot": "#ff0000"     // Red
//   };

//   const formatDealSize = (dealSize) => {
//     if (!dealSize || isNaN(dealSize)) return "N/A";
//     return parseFloat(dealSize).toLocaleString("en-US", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });
//   };

//   const totalDealSize = crmData.leads.reduce(
//     (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
//     0
//   );
//   const formattedTotalDealSize = `$${totalDealSize.toLocaleString("en-US", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;

//   const detailedLeadsTable = crmData.leads
//     .map(
//       (lead) => {
//         const statusColor = statusColors[lead.status] || "#ffffff";
//         return `<tr>
//           <td>${lead.name}</td>
//           <td>${lead.company}</td>
//           <td>${lead.stage}</td>
//           <td>${lead.score}</td>
//           <td style="background-color: ${statusColor};">${lead.status}</td>
//           <td>${formatDealSize(lead.oppValue)}</td>
//         </tr>`;
//       }
//     )
//     .join("");

//   const promptExample = `
//     <html>
// <head>
//   <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
//   <style>
//     body {
//       font-family: 'Roboto', sans-serif;
//       color: #333;
//       background-color: #f8f9fa;
//       padding: 20px;
//     }
//     table {
//       width: 100%;
//       border-collapse: collapse;
//       margin-bottom: 20px;
//       background: white;
//     }
//     th, td {
//       padding: 10px;
//       text-align: left;
//       border-bottom: 1px solid #ddd;
//     }
//     th {
//       background-color: #007bff;
//       color: white;
//     }
//   </style>
// </head>
// <body>
//   <h3>Detailed Lead Information</h3>
//   <table>
//     <tr>
//       <th>Lead Name</th>
//       <th>Company</th>
//       <th>Stage</th>
//       <th>Lead Score</th>
//       <th>Status</th>
//       <th>Deal Size ($)</th>
//     </tr>
//     ${detailedLeadsTable}
//   </table>
//   <h3>Breakdown by Country</h3>
//   <table>
//     <tr>
//       <th>Country</th>
//       <th>Leads Count</th>
//       <th>Total Deal Size ($)</th>
//     </tr>
//     ${countryTable}
//   </table>
//   <h3>Summary</h3>
//   <table>
//     <tr>
//       <td>Total Deal Size</td>
//       <td>${formattedTotalDealSize}</td>
//     </tr>
//   </table>
//   <h3>Breakdown by Lead Source</h3>
//   <table>
//     <tr>
//       <th>Source</th>
//       <th>Total Leads</th>
//       <th>Leads (%)</th>
//       <th>Total Deal Size ($)</th>
//     </tr>
//     ${leadSourceTable}
//   </table>
//   <table class="summary-table">
//     <tr>
//       <td>Total Deal Size</td>
//       <td>${formattedTotalDealSize}</td>
//     </tr>
//   </table>
  
//   <h3>Campaign Performance Table</h3>
//   <table>
//     <tr>
//       <th>Campaign Name</th>
//       <th>Total Leads</th>
//       <th>Percentage</th>
//       <th>Total Deal Size ($)</th>
//     </tr>
//     ${campaignTable}
//   </table>
//   <table class="summary-table">
//     <tr>
//       <td>Total Deal Size</td>
//       <td>${formattedTotalDealSize}</td>
//     </tr>
//   </table>
// </body>
// </html>
//   `;

//   return promptExample;
// };
