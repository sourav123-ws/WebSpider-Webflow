import {
  fetchCRMData,
  fetchLatestLeadsByDate,
  fetchTenderPreQuotesData,
  fetchTenderSpecificData,
} from "./monday.js";
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

export const generatePromptDateWise = async () => {
  const crmData = await fetchLatestLeadsByDate();
  const todayDate = getCurrentDate();

  const leadsWithComments = await Promise.all(
    crmData.leads.map(async (lead) => {
      return {
        id: lead.id,
        date: lead.date ? lead.date.split("T")[0] : "Unknown",
        campaignName:
          lead.campaignName === "N/A" ? "Others" : lead.campaignName,
        campaignId:
          lead.campaignId === "N/A"
            ? "Referral,Website,Calendly"
            : lead.campaignId,
        leadName: lead.fullName || "N/A",
        status: lead.status || "N/A",
        stage: lead.stage || "N/A",
        comment: lead.comment || "N/A",
        companyName: lead.company || "N/A",
      };
    })
  );

  const dateGroups = {};
  leadsWithComments.forEach((lead) => {
    if (!dateGroups[lead.date]) {
      dateGroups[lead.date] = [];
    }
    dateGroups[lead.date].push(lead);
  });

  const dateTable = Object.entries(dateGroups)
    .map(([date, leads]) =>
      leads
        .map(
          (lead, index) => `
        <tr>
          ${
            index === 0
              ? `<td rowspan="${leads.length}" style="padding: 12px; text-align: left;">${date}</td>`
              : ""
          }
          <td style="padding: 12px; text-align: left;">${lead.campaignName} (${
            lead.campaignId
          })</td>
          <td style="padding: 12px; text-align: left;">
  <a href="https://webspiders-force.monday.com/boards/1964391477/pulses/${
    lead.id
  }" 
     target="_blank" 
     style="color: #007bff; text-decoration: none; font-weight: bold;">
    ${lead.leadName}
  </a>
</td>
          <td style="padding: 12px; text-align: left;">${lead.companyName}</td>
          <td style="padding: 12px; text-align: left;">${lead.status}</td>
          <td style="padding: 12px; text-align: left;" class="${
            lead.stage.toLowerCase() === "cold"
              ? "cold"
              : lead.stage.toLowerCase() === "warm"
              ? "warm"
              : lead.stage.toLowerCase() === "hot"
              ? "hot"
              : ""
          }">${lead.stage}</td>
          <td style="padding: 12px; text-align: left;">${lead.comment}</td>
        </tr>`
        )
        .join("")
    )
    .join("");

  // Construct HTML with Advanced CSS
  const emailHtml = `
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
      background: linear-gradient(135deg, #f8f9fa, #e9ecef); 
      padding: 20px; 
    }
    .container { 
      max-width: 900px; 
      margin: auto; 
      background: #fff; 
      padding: 20px; 
      border-radius: 12px; 
      box-shadow: 0px 4px 20px rgba(0,0,0,0.1); 
    }
    h3 { 
      color: #007bff; 
      margin-bottom: 15px; 
      font-size: 20px; 
      font-weight: 700; 
      text-transform: uppercase; 
      letter-spacing: 1px; 
    }
    p { 
      margin: 10px 0; 
      font-size: 14px; 
      line-height: 1.6; 
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px; 
      background: #fff; 
      border-radius: 12px; 
      overflow: hidden; 
      box-shadow: 0px 4px 10px rgba(0,0,0,0.1); 
    }
    th, td { 
      padding: 12px; 
      text-align: left; 
      border-bottom: 1px solid #ddd; 
      font-size: 14px; 
    }
    th { 
      background: linear-gradient(135deg, #007bff, #0056b3); 
      color: white; 
      font-weight: 500; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
    }
    tr:nth-child(even) { 
      background-color: #f9f9f9; 
    }
    tr:hover { 
      background-color: #f1f1f1; 
      transition: background-color 0.3s ease; 
    }
    tr:hover td { 
      color: #333; /* Dark text color on hover for better visibility */
    }
    /* Status colors with animations */
    .cold { 
      background-color: #007bff !important; 
      color: white; 
      font-weight: bold; 
      animation: pulseCold 1.5s infinite; 
    }
    .warm { 
      background-color: #ffc107 !important; 
      color: black; 
      font-weight: bold; 
      animation: pulseWarm 1.5s infinite; 
    }
    .hot { 
      background-color: #dc3545 !important; 
      color: white; 
      font-weight: bold; 
      animation: pulseHot 1.5s infinite; 
    }
    @keyframes pulseCold {
      0% { background-color: #007bff; }
      50% { background-color: #0056b3; }
      100% { background-color: #007bff; }
    }
    @keyframes pulseWarm {
      0% { background-color: #ffc107; }
      50% { background-color: #e0a800; }
      100% { background-color: #ffc107; }
    }
    @keyframes pulseHot {
      0% { background-color: #dc3545; }
      50% { background-color: #a71d2a; }
      100% { background-color: #dc3545; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h3>Recent 25 Leads (SpiderX.ai)- Breakdown by Recent Date</h3>
    <table>
      <tr>
        <th>Date</th>
        <th>Campaign Name (Campaign ID)</th>
        <th>Lead Name</th>
        <th>Company Name</th>
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

export const generateSpecificSourcePrompt = async () => {
  const specificSourceData = await fetchTenderSpecificData();
  const fetchTenderPreQuotes = await fetchTenderPreQuotesData();
  console.log("FETCH TENDER PRE QUOTES DATA",fetchTenderPreQuotes);

  const todayDate = getCurrentDate();

  const countryCounts = {};
  specificSourceData.leads.forEach((lead) => {
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
      return `<tr><td style="padding: 12px; text-align: left;">${country}</td>
                  <td style="padding: 12px; text-align: left;">${total}</td>
                  <td style="padding: 12px; text-align: left;">${formattedValuation}</td></tr>`;
    })
    .join("");

  const sourceCounts = {};
  specificSourceData.leads.forEach((lead) => {
    const source = lead.source || "Unknown";
    const combinedSource = `${source}`;

    const oppValue = parseFloat(lead.oppValue) || 0;

    if (!sourceCounts[combinedSource]) {
      sourceCounts[combinedSource] = { total: 0, oppValue: 0 };
    }
    sourceCounts[combinedSource].total++;
    sourceCounts[combinedSource].oppValue += oppValue;
  });

  const campaignCounts = {};
  specificSourceData.leads.forEach((lead) => {
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

  const formatDealSize = (dealSize) => {
    if (!dealSize || isNaN(dealSize)) return "N/A";
    return parseFloat(dealSize).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  console.log("fetchTenderPreQuotes",fetchTenderPreQuotes);

  // const preQuoteTenderLeads = fetchTenderPreQuotes.filter(
  //   (lead) => lead.stage === "Tender" && lead.stage === "Pre Quote"
  // );

  const preQuoteTenderTable = fetchTenderPreQuotes
  .map((lead) => {
    return `
      <tr>
        <td style="padding: 12px; text-align: left;">
          <a href="https://webspiders-force.monday.com/boards/1964391477/pulses/${lead.id}" 
             target="_blank" 
             style="color: #007bff; text-decoration: none; font-weight: bold;">
            ${lead.company}
          </a>
        </td>
        <td style="padding: 12px; text-align: left;">${lead.country}</td>
        <td style="padding: 12px; text-align: left;">${lead.stage}</td>
        <td style="padding: 12px; text-align: left;">${lead.dueDate}</td>
      </tr>
    `;
  })
  .join("");


  const totalDealSize = specificSourceData.leads.reduce(
    (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
    0
  );
  const formattedTotalDealSize = `$${totalDealSize.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const activeLeads = specificSourceData.leads.filter(
    (lead) =>
      lead.stage !== "Closed  Lost" && lead.stage !== "Closed No Decision"
  );

  // Updated detailedLeadsTable with status coloring for N/A
  const detailedLeadsTable = activeLeads
    .map((lead) => {
      return `<tr>
      <td style="padding: 12px; text-align: left;">
  <a href="https://webspiders-force.monday.com/boards/1964391477/pulses/${
    lead.id
  }" 
     target="_blank" 
     style="color: #007bff; text-decoration: none; font-weight: bold;">
    ${lead.company}
  </a>
</td>
              <td style="padding: 12px; text-align: left;">${lead.country}</td>
              <td style="padding: 12px; text-align: left;">${lead.stage}</td>
              <td style="padding: 12px; text-align: left;">${formatDealSize(
                lead.oppValue
              )}</td>
              <td style="padding: 12px; text-align: left;">${
                lead.dateOfSubmission
              }</td>
            </tr>`;
    })
    .join("");

  const totalLeads =
    specificSourceData.totalLeads ||
    Object.values(sourceCounts).reduce((sum, s) => sum + s.total, 0);

  const closedLostOrNoDecisionLeads = specificSourceData.leads.filter(
    (lead) =>
      lead.stage === "Closed  Lost" || lead.stage === "Closed No Decision"
  );

  const detailedClosedLeadsTable = closedLostOrNoDecisionLeads
    .map((lead) => {
      return `<tr>
          <td style="padding: 12px; text-align: left;">
            <a href="https://webspiders-force.monday.com/boards/1964391477/pulses/${
              lead.id
            }" 
               target="_blank" 
               style="color: #007bff; text-decoration: none; font-weight: bold;">
              ${lead.company}
            </a>
          </td>
          <td style="padding: 12px; text-align: left;">${lead.country}</td>
          <td style="padding: 12px; text-align: left;">${lead.stage}</td>
          <td style="padding: 12px; text-align: left;">${formatDealSize(
            lead.oppValue
          )}</td>
          <td style="padding: 12px; text-align: left;">${
            lead.dateOfSubmission
          }</td>
        </tr>`;
    })
    .join("");

  // const closedLostOrNoDecisionLeads = specificSourceData.leads.filter(
  //   (lead) =>
  //     lead.stage === "Closed  Lost" || lead.stage === "Closed No Decision"
  // );


  const totalClosedLostOrNoDecisionDealSize =
    closedLostOrNoDecisionLeads.reduce(
      (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
      0
    );

  const totalActiveDealSize = activeLeads.reduce(
    (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
    0
  );

  const formattedTotalClosedLostOrNoDecisionDealSize = `$${totalClosedLostOrNoDecisionDealSize.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

  const formattedTotalActiveDealSize = `$${totalActiveDealSize.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

  const leadSourceTable = Object.entries(sourceCounts)
    .map(([combinedSource, { total, oppValue }]) => {
      const percentage = ((total / totalLeads) * 100).toFixed(2) + "%";
      const formattedOppValue = oppValue
        ? parseFloat(oppValue).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "N/A";

      return `<tr><td style="padding: 12px; text-align: left;">${combinedSource}</td>
                  <td style="padding: 12px; text-align: left;">${total}</td>
                  <td style="padding: 12px; text-align: left;">${percentage}</td>
                  <td style="padding: 12px; text-align: left;">${formattedOppValue}</td></tr>`;
    })
    .join("");

  const uniqueSources = Object.keys(sourceCounts)
    .map((source) => `<span class="source-tag">${source}</span>`)
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
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 20px;
            font-size: 14px;
          }
            h4{
              margin-top: 20px;
              margin-bottom: 10px;
              color: #007bff;
              font-weight: 700;
              font-size: 18px;
              text-transform: uppercase;
              letter-spacing: 1px;
              }
          h3 {
            margin-top: 20px;
            margin-bottom: 10px;
            color: #007bff;
            font-weight: 700;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            border: 1px solid #ddd;
            overflow: hidden;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
          }
          th {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            text-transform: uppercase;
            font-weight: 500;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr:hover {
            background-color: #f1f1f1;
            transition: background-color 0.3s ease;
          }
          tr:hover td {
            color: #333;
          }
            .deals-container {
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }

          .active-deals {
            background-color: #e3f2fd; /* Light Blue */
          }

          .closed-deals {
            background-color: #ffebee; /* Light Red */
          }
          .summary-table {
            width: 40%;
            margin-left: auto;
            background: linear-gradient(135deg, #343a40, #212529);
            color: white;
            border: 1px solid #ddd;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          }
          .summary-table td {
            border: 1px solid #ddd;
            padding: 12px;
            font-weight: bold;
            font-size: 14px;
          }
          p {
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.6;
          }
          .sources-list {
            margin-bottom: 15px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .source-tag {
            background: #4CAF50;
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
          }
          /* Status colors with animations */
          .cold {
            background-color: #007bff !important;
            color: white;
            font-weight: bold;
            animation: pulseCold 1.5s infinite;
          }
          .warm {
            background-color: #ffc107 !important;
            color: black;
            font-weight: bold;
            animation: pulseWarm 1.5s infinite;
          }
          .hot {
            background-color: #dc3545 !important;
            color: white;
            font-weight: bold;
            animation: pulseHot 1.5s infinite;
          }
          .na {
            background-color: #6c757d !important; /* Gray for N/A */
            color: white;
            font-weight: bold;
            animation: pulseNA 1.5s infinite;
          }
          @keyframes pulseCold {
            0% { background-color: #007bff; }
            50% { background-color: #0056b3; }
            100% { background-color: #007bff; }
          }
          @keyframes pulseWarm {
            0% { background-color: #ffc107; }
            50% { background-color: #e0a800; }
            100% { background-color: #ffc107; }
          }
          @keyframes pulseHot {
            0% { background-color: #dc3545; }
            50% { background-color: #a71d2a; }
            100% { background-color: #dc3545; }
          }
          @keyframes pulseNA {
            0% { background-color: #6c757d; }
            50% { background-color: #495057; }
            100% { background-color: #6c757d; }
          }
        </style>
      </head>
      <body>
        <p>Hello,</p>
        <p>Below is the Specific Tender Report showing the top 20 highest value Tenders from selected sources.</p>
        
        <div class="sources-list">
          ${uniqueSources}
        </div>
      
        <h3>Overall Pipeline Metrics (Specific Sources)</h3>
        <table>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Total Deal Value(Converted to $)</th>
          </tr>
          <tr>
            <td>Total Tenders in Pipeline</td>
            <td>${specificSourceData.totalLeads || "N/A"}</td>
            <td>${formattedTotalDealSize}</td>
          </tr>
        </table>

        <h3>New Tenders Shortlisted</h3>
        <table>
          <tr>
            <th>Company</th>
            <th>Country</th>
            <th>Stage</th>
            <th>Due Date</th>
          </tr>
          ${preQuoteTenderTable}
        </table>
      
        <h3>Top Tenders Information (Top 20 by Deal Size)</h3>

        <div class="deals-container active-deals">
        <h4>Active Deals</h4>
        <table>
          <tr>
            <th>Company</th>
            <th>Country</th>
            <th>Stage</th>
            <th>Deal Size (Converted to $)</th>
            <th>Date Of Submission</th>
          </tr>
          ${detailedLeadsTable}
        </table>

        <table class="summary-table">
          <tr>
            <td>Total Deal Size</td>
            <td>${formattedTotalActiveDealSize}</td>
          </tr>
        </table>
        </div>

        <div class="deals-container active-deals">
        <h4>Closed Deals</h4>
        <table>
          <tr>
            <th>Company</th>
            <th>Country</th>
            <th>Stage</th>
            <th>Deal Size (Converted to $)</th>
            <th>Date Of Submission</th>
          </tr>
          ${detailedClosedLeadsTable}
        </table>
        <table class="summary-table">
          <tr>
            <td>Total Deal Size</td>
            <td>${formattedTotalClosedLostOrNoDecisionDealSize}</td>
          </tr>
        </table>
        </div>
      
        <h3>Top 20 Tenders - Breakdown by Lead Source</h3>
        <table>
          <tr>
            <th>Source</th>
            <th>Total Leads</th>
            <th>Leads (%)</th>
            <th>Total Deal Size (Converted to $)</th>
          </tr>
          ${leadSourceTable}
        </table>
        <table class="summary-table">
          <tr>
            <td>Total Deal Size</td>
            <td>${formattedTotalDealSize}</td>
          </tr>
        </table>
      
        <h3>Top 20 Tenders - Breakdown by Country</h3>
        <table>
          <tr>
            <th>Country</th>
            <th>Leads Count</th>
            <th>Total Deal Size (Converted to $)</th>
          </tr>
          ${countryTable}
        </table>
        <table class="summary-table">
          <tr>
            <td>Total Deal Size</td>
            <td>${formattedTotalDealSize}</td>
          </tr>
        </table>
      
        <p>Thank you,</p>
        <p>SpiderX Sales AI</p>
      </body>
      </html>
      `;

  return promptExample;
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
      return `<tr><td style="padding: 12px; text-align: left;">${country}</td>
              <td style="padding: 12px; text-align: left;">${total}</td>
              <td style="padding: 12px; text-align: left;">${formattedValuation}</td></tr>`;
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

      const formattedTotalLeads = totalLeads;

      const formattedRevenueImpact = revenueImpact.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return `<tr>
      <td style="padding: 12px; text-align: left;">${campaign}</td>
      <td style="padding: 12px; text-align: left;">${formattedTotalLeads}</td>
      <td style="padding: 12px; text-align: left;">${percentage}</td>
      <td style="padding: 12px; text-align: left;">${formattedRevenueImpact}</td>
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

  // Filter leads with status "Closed Lost" or "Closed No Decision"
  const closedLostOrNoDecisionLeads = crmData.leads.filter(
    (lead) =>
      lead.stage === "Closed  Lost" || lead.stage === "Closed No Decision"
  );

  const activeLeads = crmData.leads.filter(
    (lead) =>
      lead.stage !== "Closed  Lost" && lead.stage !== "Closed No Decision"
  );

  const totalClosedLostOrNoDecisionDealSize =
    closedLostOrNoDecisionLeads.reduce(
      (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
      0
    );

  const totalActiveDealSize = activeLeads.reduce(
    (sum, lead) => sum + (parseFloat(lead.oppValue) || 0),
    0
  );

  const formattedTotalClosedLostOrNoDecisionDealSize = `$${totalClosedLostOrNoDecisionDealSize.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

  const formattedTotalActiveDealSize = `$${totalActiveDealSize.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;

  // Table for Closed Lost or Closed No Decision leads
  const closedLostOrNoDecisionTable = closedLostOrNoDecisionLeads
    .map((lead) => {
      let statusClass = "";
      if (lead.status === "Cold") statusClass = "cold";
      else if (lead.status === "Hot") statusClass = "hot";
      else if (lead.status === "Warm") statusClass = "warm";
      else if (lead.status === "N/A" || "Default") statusClass = "na";

      return `<tr>
          <td style="padding: 12px; text-align: left;">
  <a href="https://webspiders-force.monday.com/boards/1964391477/pulses/${
    lead.id
  }" 
     target="_blank" 
     style="color: #007bff; text-decoration: none; font-weight: bold;">
    ${lead.name}
  </a>
</td>
          <td style="padding: 12px; text-align: left;">${lead.company}</td>
          <td style="padding: 12px; text-align: left;">${lead.stage}</td>
          <td style="padding: 12px; text-align: left;" class="${statusClass}">${
        lead.status
      }</td>
          <td style="padding: 12px; text-align: left;">${formatDealSize(
            lead.oppValue
          )}</td>
          <td style="padding: 12px 20px; text-align: left; font-size: 12px; color: #555; min-width: 180px;">${
            lead.comments
          }</td>
        </tr>`;
    })
    .join("");

  // Updated detailedLeadsTable with status coloring for N/A
  const detailedLeadsTable = activeLeads
    .map((lead) => {
      let statusClass = "";
      if (lead.status === "Cold") statusClass = "cold";
      else if (lead.status === "Hot") statusClass = "hot";
      else if (lead.status === "Warm") statusClass = "warm";
      else if (lead.status === "N/A" || "Default") statusClass = "na";

      return `<tr>
          <td style="padding: 12px; text-align: left;">
  <a href="https://webspiders-force.monday.com/boards/1964391477/pulses/${
    lead.id
  }" 
     target="_blank" 
     style="color: #007bff; text-decoration: none; font-weight: bold;">
    ${lead.name}
  </a>
</td>
          <td style="padding: 12px; text-align: left;">${lead.company}</td>
          <td style="padding: 12px; text-align: left;">${lead.stage}</td>
          <td style="padding: 12px; text-align: left;" class="${statusClass}">${
        lead.status
      }</td>
          <td style="padding: 12px; text-align: left;">${formatDealSize(
            lead.oppValue
          )}</td>
          <td style="padding: 12px 20px; text-align: left; font-size: 12px; color: #555; min-width: 180px;">${
            lead.comments
          }</td>
        </tr>`;
    })
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

      return `<tr><td style="padding: 12px; text-align: left;">${source}</td>
              <td style="padding: 12px; text-align: left;">${total}</td>
              <td style="padding: 12px; text-align: left;">${percentage}</td>
              <td style="padding: 12px; text-align: left;">${formattedOppValue}</td></tr>`;
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
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        padding: 20px;
        font-size: 14px;
      }
        h4{
        margin-top: 20px;
        margin-bottom: 10px;
        color: #007bff;
        font-weight: 700;
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 1px;
        }
      h3 {
        margin-top: 20px;
        margin-bottom: 10px;
        color: #007bff;
        font-weight: 700;
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        border: 1px solid #ddd;
        overflow: hidden;
      }
        .closed-lost-table {
  width: 100%;
  border-collapse: collapse;
  background-color: #ffe6e6; /* Light reddish background */
}
  .closed-lost-table th {
  background: linear-gradient(to right, #cc0000, #ff4d4d); /* Red gradient */
  color: white;
  padding: 12px;
  text-align: left;
  border-radius: 8px 8px 0 0; /* Curved top corners */
  font-weight: bold;
}
      th, td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
        font-size: 14px;
      }
      th {
        background: linear-gradient(135deg, #007bff, #0056b3);
        color: white;
        text-transform: uppercase;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
      tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      tr:hover {
        background-color: #f1f1f1;
        transition: background-color 0.3s ease;
      }
      tr:hover td {
        color: #333;
      }
      .summary-table {
        width: 40%;
        margin-left: auto;
        background: linear-gradient(135deg, #343a40, #212529);
        color: white;
        border: 1px solid #ddd;
        border-radius: 12px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      }
      .summary-table td {
        border: 1px solid #ddd;
        padding: 12px;
        font-weight: bold;
        font-size: 14px;
      }
      p {
        margin-bottom: 10px;
        font-size: 14px;
        line-height: 1.6;
      }
      /* Status colors with animations */
      .cold {
        background-color: #007bff !important;
        color: white;
        font-weight: bold;
        animation: pulseCold 1.5s infinite;
      }
      .warm {
        background-color: #ffc107 !important;
        color: black;
        font-weight: bold;
        animation: pulseWarm 1.5s infinite;
      }
      .hot {
        background-color: #dc3545 !important;
        color: white;
        font-weight: bold;
        animation: pulseHot 1.5s infinite;
      }
      .na {
        background-color: #6c757d !important;
        color: white;
        font-weight: bold;
        animation: pulseNA 1.5s infinite;
      }
        h3 {
  font-size: 22px;
  text-align: center;
  color: #003366;
  background: linear-gradient(135deg, #004085, #0056b3);
  padding: 10px;
  border-radius: 8px;
  color: white;
}

.deals-container {
  margin: 20px 0;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.active-deals {
  background-color: #e3f2fd; /* Light Blue */
}

.closed-deals {
  background-color: #ffebee; /* Light Red */
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th {
  background-color: #004085;
  color: white;
  padding: 10px;
  text-align: left;
}

td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

      @keyframes pulseCold {
        0% { background-color: #007bff; }
        50% { background-color: #0056b3; }
        100% { background-color: #007bff; }
      }
      @keyframes pulseWarm {
        0% { background-color: #ffc107; }
        50% { background-color: #e0a800; }
        100% { background-color: #ffc107; }
      }
      @keyframes pulseHot {
        0% { background-color: #dc3545; }
        50% { background-color: #a71d2a; }
        100% { background-color: #dc3545; }
      }
      @keyframes pulseNA {
        0% { background-color: #6c757d; }
        50% { background-color: #495057; }
        100% { background-color: #6c757d; }
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
        <th>Deals Count</th>
        <th>Total Deal Value(Converted to $)</th>
      </tr>
      <tr>
        <td>Total Deals in Pipeline</td>
        <td>${crmData.totalLeads || "N/A"}</td>
        <td>${formattedTotalDealSize}</td>
      </tr>
    </table>
  
    <h3>Top 25 Deals (SpiderX.ai) Information</h3>

<div class="deals-container active-deals">
  <h4>Active Deals</h4>
  <table>
    <tr>
      <th>Lead Name</th>
      <th>Company</th>
      <th>Stage</th>
      <th>Status</th>
      <th>Deal Size (Converted to $)</th>
      <th>Comments(Activity)</th>
    </tr>
    ${detailedLeadsTable}
  </table>
  
  <table class="summary-table">
    <tr>
      <td><strong>Total Deal Size</strong></td>
      <td><strong>${formattedTotalActiveDealSize}</strong></td>
    </tr>
  </table>
</div>

<div class="deals-container closed-deals">
  <h4>Closed Deals(Lost/No Decision)</h4>
  <table>
    <tr>
      <th>Lead Name</th>
      <th>Company</th>
      <th>Stage</th>
      <th>Status</th>
      <th>Deal Size (Converted to $)</th>
      <th>Comments(Activity)</th>
    </tr>
    ${closedLostOrNoDecisionTable}
  </table>
  <table class="summary-table">
        <tr>
          <td><strong>Total Deal Size</strong></td>
          <td><strong>${formattedTotalClosedLostOrNoDecisionDealSize}</strong></td>
        </tr>
      </table>
</div>

    <h3>Top 25 Deals - Sources Breakdown (SpiderX.ai)</h3>
    <table>
      <tr>
        <th>Source</th>
        <th>Total Leads</th>
        <th>Leads (%)</th>
        <th>Total Deal Size (Converted to $)</th>
      </tr>
      ${leadSourceTable}
    </table>
    <table class="summary-table">
      <tr>
        <td>Total Deal Size</td>
        <td>${formattedTotalDealSize}</td>
      </tr>
    </table>
    
    <h3>Top 25 Deals - Campaign Performance(SpiderX.ai)</h3>
    <table>
      <tr>
        <th>Campaign Name</th>
        <th>Total Leads</th>
        <th>Percentage</th>
        <th>Total Deal Size (Converted to $)</th>
      </tr>
      ${campaignTable}
    </table>
    <table class="summary-table">
      <tr>
        <td>Total Deal Size</td>
        <td>${formattedTotalDealSize}</td>
      </tr>
    </table>
  
    <h3>Top 25 Deals - Country(SpiderX.ai)</h3>
    <table>
      <tr>
        <th>Country</th>
        <th>Leads Count</th>
        <th>Total Deal Size (Converted to $)</th>
      </tr>
      ${countryTable}
    </table>
    <table class="summary-table">
      <tr>
        <td>Total Deal Size</td>
        <td>${formattedTotalDealSize}</td>
      </tr>
    </table>
  
    <p>Thank you,</p>
    <p>SpiderX Sales AI</p>
  </body>
  </html>
  `;

  return promptExample;
};
