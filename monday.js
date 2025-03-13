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


export const main = async () => {
  const prompt = await generatePrompt();
  const todayDate = getCurrentDate();
  const subject = `Daily Lead Summary Report -  ${todayDate} (Top 25 Deals) - [Preview Mode]`

  // console.log("Prompt",prompt);

  // sendMail(
  //   "dipesh.majumder@webspiders.com",
  //   prompt,
  //   subject,
  //   "sourav.bhattacherjee@webspiders.com"
  // );

  // console.log("Formatted HTML Email Body:", aiTableResponseText);
};
