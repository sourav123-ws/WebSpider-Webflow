import fs from "fs";
import nodemailer from "nodemailer";
import { generatePrompt , getCurrentDate } from "./prompt.js";
import { completions } from "./openai.js";
import { sendMail } from "./utils.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = 1944965797;

// export const fetchCRMData = async () => {
//   let allItems = [];
//   let cursor = null;
//   let hasMore = true;

//   try {
//       while (hasMore) {
//           const query = `
//               query {
//                   boards(ids: ${BOARD_ID}) {
//                       id
//                       name
//                       items_page (limit: 100, cursor: ${cursor ? `"${cursor}"` : "null"}) {
//                           cursor
//                           items {
//                               id
//                               name
//                               column_values {
//                                   id
//                                   text
//                               }
//                           }
//                       }
//                   }
//               }
//           `;

//           const response = await axios.post(
//               "https://api.monday.com/v2",
//               { query },
//               {
//                   headers: {
//                       Authorization: `Bearer ${MONDAY_API_KEY}`,
//                       "Content-Type": "application/json",
//                   },
//               }
//           );

//           const items = response.data?.data?.boards?.[0]?.items_page?.items || [];
//           allItems.push(...items);

//           cursor = response.data?.data?.boards?.[0]?.items_page?.cursor;
//           hasMore = !!cursor;
//       }

//       console.log(`✅ Fetched ${allItems.length} items from board ${BOARD_ID}`);

//       const structuredData = {
//           totalLeads: allItems.length,
//           qualifiedLeads: allItems.filter(item => {
//               return item.column_values.some(col => col.id === "qualified_id" && col.text === "Yes");
//           }).length,
//           leads: allItems.map(deal => ({
//               name: deal.column_values.find(col => col.id === "client_name_mkmx5s30")?.text || 'N/A',
//               company: deal.column_values.find(col => col.id === "text_mknx7fx9")?.text || 'N/A',
//               stage: deal.column_values.find(col => col.id === "deal_stage")?.text || 'N/A',
//               status: deal.column_values.find(col => col.id === "color_mknbte2j")?.text || 'N/A',
//               dealSize: deal.column_values.find(col => col.id === "numeric_mknx4ka9")?.text || 'N/A',
//               lastContact: deal.column_values.find(col => col.id === "date_mkna3qt1")?.text || 'N/A',
//           })),
//           leadSources: [],
//           campaigns: [],
//           countries: [],
//           aiInsights: [],
//           priorityLeads: allItems
//               .filter(deal => deal.oppValue > 500000)
//               .map(deal => deal.name)
//       };

//       return structuredData;
//   } catch (error) {
//       console.error(
//           "❌ Error fetching CRM data:",
//           JSON.stringify(error.response?.data || error.message, null, 2)
//       );
//       return {
//           totalLeads: 0,
//           qualifiedLeads: 0,
//           leads: [],
//           leadSources: [],
//           campaigns: [],
//           countries: [],
//           aiInsights: [],
//           priorityLeads: []
//       };
//   }
// };

export const fetchCRMData = async () => {
  let allItems = [];
  let cursor = null;
  let hasMore = true;

  try {
    while (hasMore) {
      const query = `
        query {
          boards(ids: ${BOARD_ID}) {
            id
            name
            items_page (limit: 100, cursor: ${
              cursor ? `"${cursor}"` : "null"
            }) {
              cursor
              items {
                id
                name
                column_values {
                  id
                  text
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(
        "https://api.monday.com/v2",
        { query },
        {
          headers: {
            Authorization: `Bearer ${MONDAY_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const items = response.data?.data?.boards?.[0]?.items_page?.items || [];
      allItems.push(...items);
      cursor = response.data?.data?.boards?.[0]?.items_page?.cursor;
      hasMore = !!cursor;
    }

    console.log(`✅ Fetched ${allItems.length} items from board ${BOARD_ID}`);

    let structuredLeads = allItems.map((deal) => ({
      name:
        deal.column_values.find((col) => col.id === "client_name_mkmx5s30")
          ?.text || "N/A",
      company:
        deal.column_values.find((col) => col.id === "text_mknx7fx9")?.text ||
        "N/A",
      stage:
        deal.column_values.find((col) => col.id === "deal_stage")?.text ||
        "N/A",
      leadStatus:
        deal.column_values.find((col) => col.id === "color_mknbte2j")?.text ||
        "N/A",
      score:
        deal.column_values.find((col) => col.id === "numeric_mknseckr")?.text ||
        "N/A",
      status:
        deal.column_values.find((col) => col.id === "color_mknt1t1j")?.text ||
        "N/A",
      date:
        deal.column_values.find((col) => col.id === "date_mknjmf73")?.text ||
        "N/A",
      comments:
        deal.column_values.find((col) => col.id === "comments_Mjj4ohM0")
          ?.text || "N/A",
      currency:
        deal.column_values.find((col) => col.id === "currency_Mjj4a1M0")
          ?.text || "N/A",
      oppValue: parseFloat(
        deal.column_values
          .find((col) => col.id === "numeric_mknx4ka9")
          ?.text?.replace(/,/g, "") || 0
      ),
      email:
        deal.column_values.find((col) => col.id === "email_mknbf23h")?.text ||
        "N/A",
      phone:
        deal.column_values.find((col) => col.id === "text_mknch1b6")?.text ||
        "N/A",
      source:
        deal.column_values.find((col) => col.id === "dropdown_mkncv7g")?.text ||
        "N/A",
      agents:
        deal.column_values.find((col) => col.id === "dropdown_mknc2kqf")
          ?.text || "N/A",
      platform:
        deal.column_values.find((col) => col.id === "text_mkncp8vt")?.text ||
        "N/A",
      campaignName:
        deal.column_values.find((col) => col.id === "text_mkncshyb")?.text ||
        "N/A",
      country:
        deal.column_values.find((col) => col.id === "country_mknzs6a9")?.text ||
        "N/A",
      submissionDate:
        deal.column_values.find((col) => col.id === "submission_date_Mjj4fLpB")
          ?.text || "N/A",
      lineOfBusiness:
        deal.column_values.find((col) => col.id === "line_of_business_Mjj4DMY9")
          ?.text || "N/A",
      sourceOfOpportunity:
        deal.column_values.find(
          (col) => col.id === "source_of_opportunity_Mjj45Qma"
        )?.text || "N/A",
      expectedCloseDate:
        deal.column_values.find((col) => col.id === "deal_expected_close_date")
          ?.text || "N/A",
      proposalName:
        deal.column_values.find((col) => col.id === "proposal_name_Mjj44MAX")
          ?.text || "N/A",
      forecastValue:
        deal.column_values.find((col) => col.id === "deal_forecast_value")
          ?.text || "N/A",
      quoteDocLink:
        deal.column_values.find(
          (col) => col.id === "quote_doc_folder_link_Mjj4w7LI"
        )?.text || "N/A",
      proposalDocLink:
        deal.column_values.find(
          (col) => col.id === "proposal_folder_link_mkmxcg7w"
        )?.text || "N/A",
      lastActivityDate:
        deal.column_values.find((col) => col.id === "date_mkna3qt1")?.text ||
        "N/A",
    }));

    structuredLeads = structuredLeads
      .sort((a, b) => b.oppValue - a.oppValue)
      .slice(0, 15);

    const structuredData = {
      totalLeads: structuredLeads.length,
      qualifiedLeads: structuredLeads.filter(
        (item) => item.status === "Qualified"
      ).length,
      leads: structuredLeads,
      leadSources: structuredLeads.map((deal) => deal.source),
      campaigns: structuredLeads.map((deal) => deal.campaignName),
      countries: [],
      aiInsights: [],
      priorityLeads: structuredLeads.map((deal) => deal.name),
    };

    return structuredData;
  } catch (error) {
    console.error(
      "❌ Error fetching CRM data:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      leads: [],
      leadSources: [],
      campaigns: [],
      countries: [],
      aiInsights: [],
      priorityLeads: [],
    };
  }
};

export const main = async () => {
  const prompt = await generatePrompt();
  const subject = "Daily Lead Report"

  console.log("Prompt",prompt);

  // let messages = [
  //   {
  //     role: "system",
  //     content:
  //       "You are a high-level sales assistant generating a CRM daily summary email.",
  //   },
  //   { role: "user", content: prompt },
  // ];

  // messages = messages.slice(-10);

  // const aiResponse = await completions(messages);
  // const aiResponseText = String(aiResponse.data || aiResponse);

  // const todayDate = getCurrentDate();
  // const subject = `Daily Lead Summary – Report ${todayDate}`;

  // const emailBody = aiResponseText.replace(/^Subject:.*?\n\n/, "").trim();
  // console.log("Initial Email Body:", emailBody);

//   // Now, call OpenAI again to format the emailBody into a proper HTML table format
//   const tablePrompt = `
//     Convert the following raw text data into a professionally formatted email with clear headings, structured tables, and a polished layout. Ensure readability and clarity while maintaining a formal business tone.
// Email Structure:
// Subject Line: Use a professional and concise subject that summarizes the report.
// Greeting: Address the recipient properly.
// Introduction: Provide a brief summary of the key insights from the data.
// Lead Pipeline Overview: Present the total leads in a clear format.
// Detailed Lead Information: Format the lead data into a clean, structured table.
// Lead Source Breakdown: Display the breakdown in a well-aligned table.
// Campaign Performance Table: Present campaign statistics in a readable format.
// Conclusion & Next Steps: Provide key takeaways and any required actions.
// Sign-off: End with a professional closing.
// Raw Data for Formatting:

// Summary:
//     ${emailBody}

// Formatting Guidelines:
// Use bold for section headings.
// Ensure tables have even column spacing and are aligned.
// Round large numbers for readability if needed.
// Use bullet points or highlights for key insights.
    
//   `;

//   // Prepare the messages for the second API call
//   let tableMessages = [
//     {
//       role: "system",
//       content:
//         "You are an assistant formatting CRM daily summaries into structured HTML tables.",
//     },
//     { role: "user", content: tablePrompt },
//   ];

//   // Get the formatted HTML table from OpenAI
//   const aiTableResponse = await completions(tableMessages);
//   const aiTableResponseText = String(aiTableResponse.data || aiTableResponse);

  // console.log("AI Table Response",aiTableResponse);

  // sendMail(
  //   "utsab.ghosh@webspiders.com",
  //   prompt,
  //   subject,
  //   "sourav.bhattacherjee@webspiders.com"
  // );

  // console.log("Formatted HTML Email Body:", aiTableResponseText);
};
