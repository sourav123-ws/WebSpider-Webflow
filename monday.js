import fs from "fs";
import nodemailer from "nodemailer";
import {
  generatePrompt,
  generatePromptDateWise,
  generateSpecificSourcePrompt,
  getCurrentDate,
} from "./prompt.js";
import { completions } from "./openai.js";
import { sendMail } from "./utils.js";
import axios from "axios";
import dotenv from "dotenv";
import { getTimeOfDay } from "./utils.js";
dotenv.config();

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const BOARD_ID = 1944965797;
const LEAD_BOARD_ID = 1964391477;

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


    const excludedSources = [
      "Tender",
      "Order Forms",
      "Renewal",
      "Client Referral",
      "Tradeshow",
      "Website Enquiry",
      "CU Partnership",
      "Webinar",
    ];


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
        deal.column_values.find((col) => col.id === "color_mknbte2j")?.text ||
        "N/A",
      date:
        deal.column_values.find((col) => col.id === "date_mknjmf73")?.text ||
        "N/A",
      comments:
        deal.column_values.find((col) => col.id === "comments_Mjj4ohM0")
          ?.text || "N/A",
      oppValue: parseFloat(
        deal.column_values
          .find((col) => col.id === "numeric_mknx4ka9")
          ?.text?.replace(/,/g, "") || 0
      ),
      source:
        deal.column_values.find((col) => col.id === "dropdown_mkncv7g")?.text ||
        "N/A",
      campaignName:
        deal.column_values.find((col) => col.id === "text_mkncshyb")?.text ||
        "Others - Website Organic, Calendly",
      country:
        deal.column_values.find((col) => col.id === "country_mknzs6a9")?.text ||
        "N/A",
      sourceOfOpportunity:
        deal.column_values.find(
          (col) => col.id === "source_of_opportunity_Mjj45Qma"
        )?.text || "N/A",
      forecastValue:
        deal.column_values.find((col) => col.id === "deal_forecast_value")
          ?.text || "N/A",
      lastActivityDate:
        deal.column_values.find((col) => col.id === "date_mkna3qt1")?.text ||
        "N/A",
    }));

    structuredLeads = structuredLeads.filter(
      (lead) => !excludedSources.includes(lead.sourceOfOpportunity)
    );

    structuredLeads = structuredLeads
      .sort((a, b) => b.oppValue - a.oppValue)
      .slice(0, 25);

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

//using date

// export const fetchLatestLeadsByDate = async () => {
//   let allItems = [];
//   let cursor = null;
//   let hasMore = true;

//   try {
//     while (hasMore) {
//       const query = `
//         query {
//           boards(ids: ${LEAD_BOARD_ID}) {
//             id
//             name
//             items_page (limit: 100, cursor: ${
//               cursor ? `"${cursor}"` : "null"
//             }) {
//               cursor
//               items {
//                 id
//                 name
//                 column_values {
//                   id
//                   text
//                 }
//               }
//             }
//           }
//         }
//       `;

//       const response = await axios.post(
//         "https://api.monday.com/v2",
//         { query },
//         {
//           headers: {
//             Authorization: `Bearer ${MONDAY_API_KEY}`,
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       const items = response.data?.data?.boards?.[0]?.items_page?.items || [];
//       allItems.push(...items);
//       cursor = response.data?.data?.boards?.[0]?.items_page?.cursor;
//       hasMore = !!cursor;
//     }

//     console.log("✅ Total Leads Fetched:", allItems.length);

//     const structuredLeads = allItems.map((deal) => ({
//       leadId: deal.id || "N/A", // Add Lead ID
//       name: deal.column_values.find((col) => col.id === "name")?.text || "N/A",
//       subitems:
//         deal.column_values.find((col) => col.id === "subitems_mkmm2y67")
//           ?.text || "N/A",
//       person:
//         deal.column_values.find((col) => col.id === "person")?.text || "N/A",
//       status:
//         deal.column_values.find((col) => col.id === "status")?.text || "N/A",
//       stage:
//         deal.column_values.find((col) => col.id === "color_mknahbh4")?.text ||
//         "N/A",
//       currency:
//         deal.column_values.find((col) => col.id === "dropdown_mknkf8ae")
//           ?.text || "N/A",
//       dealsValue: parseFloat(
//         deal.column_values
//           .find((col) => col.id === "numeric_mknkp8zv")
//           ?.text?.replace(/,/g, "") || 0
//       ),
//       leadScore:
//         deal.column_values.find((col) => col.id === "numeric_mknst4ys")?.text ||
//         "N/A",
//       leadStage:
//         deal.column_values.find((col) => col.id === "color_mkntbxq3")?.text ||
//         "N/A",
//       createdDate:
//         deal.column_values.find((col) => col.id === "date_mknhjdhp")?.text ||
//         "N/A",
//       lastActivityDate:
//         deal.column_values.find((col) => col.id === "date_1_mkn8hht7")?.text ||
//         "N/A",
//       activeStatus:
//         deal.column_values.find((col) => col.id === "color_mkntydxy")?.text ||
//         "N/A",
//       leadOwner:
//         deal.column_values.find((col) => col.id === "text_mknpz84t")?.text ||
//         "N/A",
//       platform:
//         deal.column_values.find((col) => col.id === "text_mkn5ywg8")?.text ||
//         "N/A",
//       source:
//         deal.column_values.find((col) => col.id === "dropdown_mkn5eq9j")
//           ?.text || "N/A",
//       comment:
//         deal.column_values.find((col) => col.id === "text_mkmqmm97")?.text ||
//         "N/A",
//       fullName:
//         deal.column_values.find((col) => col.id === "full_name_mkn55xfz")
//           ?.text || "N/A",
//       email:
//         deal.column_values.find((col) => col.id === "email_mkmmdycm")?.text ||
//         "N/A",
//       phone:
//         deal.column_values.find((col) => col.id === "phone_mkmm91gk")?.text ||
//         "N/A",
//       company:
//         deal.column_values.find((col) => col.id === "text_mkmm2dhd")?.text ||
//         "N/A",
//       agentOffering:
//         deal.column_values.find((col) => col.id === "dropdown_mkmmhxtw")
//           ?.text || "N/A",
//       country:
//         deal.column_values.find((col) => col.id === "country_mkmpz8yr")?.text ||
//         "N/A",
//       campaignId:
//         deal.column_values.find((col) => col.id === "agent_name_mkmphvgg")
//           ?.text || "N/A",
//       campaignName:
//         deal.column_values.find((col) => col.id === "campaign_name_mkmpevbs")
//           ?.text || "N/A",
//       formName:
//         deal.column_values.find((col) => col.id === "text_mkn1rc24")?.text ||
//         "N/A",
//       jobDescription:
//         deal.column_values.find((col) => col.id === "designation_mkmpjymv")
//           ?.text || "N/A",
//       dealClosingPercentage:
//         deal.column_values.find((col) => col.id === "text_mkmq77bw")?.text ||
//         "N/A",
//       linkedin:
//         deal.column_values.find((col) => col.id === "linkedin_mkmpnvnp")
//           ?.text || "N/A",
//       date:
//         deal.column_values.find((col) => col.id === "date_mkn218r2")?.text ||
//         "N/A",
//     }));

//     console.log("Fetched Leads:", structuredLeads);
    

//     const latestLeads = structuredLeads
//       .filter(
//         (lead) => lead.createdDate && !isNaN(Date.parse(lead.createdDate))
//       ) // Ensure createdDate exists and is valid
//       .map((lead) => ({
//         ...lead,
//         dateObj: new Date(lead.createdDate), // Convert createdDate to Date object
//       }))
//       .sort((a, b) => b.dateObj - a.dateObj)
//       .slice(0, 25)
//       .map((lead) => {
//         delete lead.dateObj; // Remove temporary dateObj property
//         return lead;
//       });

//     return {
//       totalLeads: latestLeads.length,
//       qualifiedLeads: latestLeads.filter((item) => item.status === "Qualified")
//         .length,
//       leads: latestLeads,
//       leadSources: latestLeads.map((deal) => deal.source),
//       campaigns: latestLeads.map((deal) => deal.campaignName),
//       countries: latestLeads.map((deal) => deal.country),
//       aiInsights: [],
//       priorityLeads: latestLeads.map((deal) => deal.name),
//     };
//   } catch (error) {
//     console.error(
//       "❌ Error fetching latest leads by date:",
//       JSON.stringify(error.response?.data || error.message, null, 2)
//     );
//     return {
//       totalLeads: 0,
//       qualifiedLeads: 0,
//       leads: [],
//       leadSources: [],
//       campaigns: [],
//       countries: [],
//       aiInsights: [],
//       priorityLeads: [],
//     };
//   }
// };

export const fetchLatestLeadsByDate = async () => {
  let allItems = [];
  let cursor = null;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`🔍 Fetching batch with cursor: ${cursor || "null"}`);

      const query = `
        query {
          boards(ids: ${LEAD_BOARD_ID}) {
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


    const structuredLeads = allItems.map((deal) => {
      const createdDate =
        deal.column_values.find((col) => col.id === "date_mknhjdhp")?.text ||
        "N/A";
      const fallbackDate =
        deal.column_values.find((col) => col.id === "date_mkn218r2")?.text ||
        "N/A";

      const finalDate = createdDate !== "N/A" ? createdDate : fallbackDate;
      

      return {
        leadId: deal.id || "N/A",
        name: deal.column_values.find((col) => col.id === "name")?.text || "N/A",
        subitems:
          deal.column_values.find((col) => col.id === "subitems_mkmm2y67")
            ?.text || "N/A",
        status:
          deal.column_values.find((col) => col.id === "status")?.text || "N/A",
        stage:
          deal.column_values.find((col) => col.id === "color_mknahbh4")?.text ||
          "N/A",
        dealsValue: parseFloat(
          deal.column_values
            .find((col) => col.id === "numeric_mknkp8zv")
            ?.text?.replace(/,/g, "") || 0
        ),
        leadScore:
          deal.column_values.find((col) => col.id === "numeric_mknst4ys")
            ?.text || "N/A",
        leadStage:
          deal.column_values.find((col) => col.id === "color_mkntbxq3")?.text ||
          "N/A",
        createdDate: finalDate,
        lastActivityDate:
          deal.column_values.find((col) => col.id === "date_1_mkn8hht7")
            ?.text || "N/A",
        activeStatus:
          deal.column_values.find((col) => col.id === "color_mkntydxy")?.text ||
          "N/A",
        source:
          deal.column_values.find((col) => col.id === "dropdown_mkn5eq9j")
            ?.text || "N/A",
        comment:
          deal.column_values.find((col) => col.id === "text_mkmqmm97")?.text ||
          "N/A",
        fullName:
          deal.column_values.find((col) => col.id === "full_name_mkn55xfz")
            ?.text || "N/A",
        company:
          deal.column_values.find((col) => col.id === "text_mkmm2dhd")?.text ||
          "N/A",
        agentOffering:
          deal.column_values.find((col) => col.id === "dropdown_mkmmhxtw")
            ?.text || "N/A",
        country:
          deal.column_values.find((col) => col.id === "country_mkmpz8yr")?.text ||
          "N/A",
        campaignId:
          deal.column_values.find((col) => col.id === "agent_name_mkmphvgg")
            ?.text || "N/A",
        campaignName:
          deal.column_values.find((col) => col.id === "campaign_name_mkmpevbs")
            ?.text || "N/A",
        formName:
          deal.column_values.find((col) => col.id === "text_mkn1rc24")?.text ||
          "N/A",
        date: fallbackDate,
      };
    });

    const latestLeads = structuredLeads
      .filter(
        (lead) => lead.createdDate && !isNaN(Date.parse(lead.createdDate))
      )
      .map((lead) => ({
        ...lead,
        dateObj: new Date(lead.createdDate),
      }))
      .sort((a, b) => b.dateObj - a.dateObj)
      .slice(0, 25)
      .map((lead) => {
        delete lead.dateObj;
        return lead;
      });

    return {
      totalLeads: latestLeads.length,
      qualifiedLeads: latestLeads.filter((item) => item.status === "Qualified")
        .length,
      leads: latestLeads,
      leadSources: latestLeads.map((deal) => deal.source),
      campaigns: latestLeads.map((deal) => deal.campaignName),
      countries: latestLeads.map((deal) => deal.country),
      aiInsights: [],
      priorityLeads: latestLeads.map((deal) => deal.name),
    };
  } catch (error) {
    console.error(
      "❌ Error fetching latest leads by date:",
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

export const fetchTenderSpecificData = async () => {
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

    const includedSources = [
      "Tender",
      "Order Forms",
      "Renewal",
      "Client Referral",
      "Tradeshow",
      "Website Enquiry",
      "CU Partnership",
      "Webinar",
    ];

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
        deal.column_values.find((col) => col.id === "color_mknbte2j")?.text ||
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
      source:
        deal.column_values.find((col) => col.id === "dropdown_mkncv7g")?.text ||
        "N/A",
      agents:
        deal.column_values.find((col) => col.id === "dropdown_mknc2kqf")
          ?.text || "N/A",
      campaignName:
        deal.column_values.find((col) => col.id === "text_mkncshyb")?.text ||
        "Others - Website Organic, Calendly",
      country:
        deal.column_values.find((col) => col.id === "country_mknzs6a9")?.text ||
        "N/A",
      sourceOfOpportunity:
        deal.column_values.find(
          (col) => col.id === "source_of_opportunity_Mjj45Qma"
        )?.text || "N/A",
      expectedCloseDate:
        deal.column_values.find((col) => col.id === "deal_expected_close_date")
          ?.text || "N/A",
      lastActivityDate:
        deal.column_values.find((col) => col.id === "date_mkna3qt1")?.text ||
        "N/A",
    }));

    // Filter to INCLUDE the specified sources
    structuredLeads = structuredLeads.filter((lead) =>
      includedSources.includes(lead.sourceOfOpportunity)
    );

    // Sort by opportunity value (deal size) in descending order and limit to 25
    structuredLeads = structuredLeads
      .sort((a, b) => b.oppValue - a.oppValue)
      .slice(0, 20);

    const structuredData = {
      totalLeads: structuredLeads.length,
      qualifiedLeads: structuredLeads.filter(
        (item) => item.status === "Qualified"
      ).length,
      leads: structuredLeads,
      leadSources: structuredLeads.map((deal) => deal.source),
      campaigns: structuredLeads.map((deal) => deal.campaignName),
      countries: structuredLeads.map((deal) => deal.country),
      aiInsights: [],
      priorityLeads: structuredLeads.map((deal) => deal.name),
    };

    return structuredData;
  } catch (error) {
    console.error(
      "❌ Error fetching specific source leads:",
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
  const promptForDateFilter = await generatePromptDateWise();
  const promptForTender = await generateSpecificSourcePrompt();
  const todayDate = getCurrentDate();
  const currentHour = new Date().getHours();

  let subject;
  let subjectForDatePrompt;
  let subjectForTender;

  if (currentHour < 12) {
    subject = `Top 25 Deals(SpiderX.AI) Summary - ${todayDate} Morning Bulletin - [Preview Mode]`;
    subjectForDatePrompt = `Recent 25 Leads Summary - ${todayDate} Morning Bulletin - [Preview Mode]`;
    subjectForTender = `Top 20 Tenders Summary - ${todayDate} Morning Bulletin - [Preview Mode]`;
  } else {
    subject = `Top 25 Deals(SpiderX.AI) Summary - ${todayDate} Evening Bulletin - [Preview Mode]`;
    subjectForDatePrompt = `Recent 25 Leads Summary - ${todayDate} Evening Bulletin - [Preview Mode]`;
    subjectForTender = `Top 20 Tenders Summary - ${todayDate} Evening Bulletin - [Preview Mode]`;
  }

  // console.log("PROMPT", prompt);
  // console.log("promptForDateFilter", promptForDateFilter);
  // console.log("promptForTender", promptForTender);

  // Sending the first email
  // sendMail(
  //   "dipesh.majumder@webspiders.com",
  //   prompt,
  //   subject,
  //   "sourav.bhattacherjee@webspiders.com"
  // );

  // // Sending the second email
  // sendMail(
  //   "dipesh.majumder@webspiders.com",
  //   promptForDateFilter,
  //   subjectForDatePrompt,
  //   "sourav.bhattacherjee@webspiders.com"
  // );

  // // Sending the third email with promptForTender
  // sendMail(
  //   "dipesh.majumder@webspiders.com",
  //   promptForTender,
  //   subjectForTender,
  //   "sourav.bhattacherjee@webspiders.com"
  // );
};
