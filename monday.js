import fs from "fs";
import nodemailer from "nodemailer";
import { generatePrompt, getCurrentDate } from "./prompt.js";
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
    // 🔹 Step 1: Fetch all items from the board
    while (hasMore) {
      const query = `
        query {
          boards(ids: ${BOARD_ID}) {
            id
            name
            items_page (limit: 100, cursor: ${cursor ? `"${cursor}"` : "null"}) {
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

    // 🔹 Step 2: Map and extract necessary fields
    let structuredLeads = allItems.map(deal => ({
      name: deal.column_values.find(col => col.id === "client_name_mkmx5s30")?.text || 'N/A',
      company: deal.column_values.find(col => col.id === "text_mknx7fx9")?.text || 'N/A',
      stage: deal.column_values.find(col => col.id === "deal_stage")?.text || 'N/A',
      status: deal.column_values.find(col => col.id === "color_mknt1t1j")?.text || 'N/A',
      score : deal.column_values.find(col => col.id === "numeric_mknseckr")?.text || 'N/A',
      dealSize: deal.column_values.find(col => col.id === "numeric_mknx4ka9")?.text || 'N/A',
      lastContact: deal.column_values.find(col => col.id === "date_mkna3qt1")?.text || 'N/A',
      oppValue: parseFloat(deal.column_values.find(col => col.id === "numeric_mknx4ka9")?.text.replace(/,/g, '')) || 0 // Parse Opp. Value
    }));

    // 🔹 Step 3: Sort by Opp. Value (Descending order) and take the top 10 to 15
    structuredLeads = structuredLeads.sort((a, b) => b.oppValue - a.oppValue).slice(0, 15);

    // 🔹 Step 4: Prepare structured data
    const structuredData = {
      totalLeads: structuredLeads.length,
      qualifiedLeads: structuredLeads.filter(item => item.status === "Qualified").length,
      leads: structuredLeads,
      leadSources: [],
      campaigns: [],
      countries: [],
      aiInsights: [],
      priorityLeads: structuredLeads.map(deal => deal.name),
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
      priorityLeads: []
    };
  }
};


export const main = async () => {
  const prompt = await generatePrompt();

  let messages = [
    {
      role: "system",
      content:
        "You are a high-level sales assistant generating a CRM daily summary email.",
    },
    { role: "user", content: prompt },
  ];

  messages = messages.slice(-10);

  const aiResponse = await completions(messages);
  const aiResponseText = String(aiResponse.data || aiResponse);

//   const subjectMatch = aiResponseText.match(/^Subject:\s*(.+)$/m);
  const todayDate = getCurrentDate();
  const subject = `Daily Lead Summary – Report ${todayDate}`;

  const emailBody = aiResponseText.replace(/^Subject:.*?\n\n/, "").trim();
  console.log("Email Body:", emailBody);
  // sendMail("utsab.ghosh@webspiders.com", emailBody, subject, "sourav.bhattacherjee@webspiders.com")

  // console.log("Generated Prompt:", prompt);
};

