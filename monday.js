import fs from "fs";
import nodemailer from "nodemailer";
import { generatePrompt } from "./prompt.js";
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
  
      const sortedItems = allItems
        .map((deal) => {
          const oppValue = deal.column_values.reduce((acc, col) => {
            if (col.id === "numeric_mknx4ka9") {
              const value =
                col.text && !isNaN(parseFloat(col.text))
                  ? parseFloat(col.text)
                  : -Infinity;
              return value;
            }
            return acc;
          }, -Infinity);
  
          return { ...deal, oppValue };
        })
        .sort((a, b) => b.oppValue - a.oppValue)
        .slice(0, 10);
  
    //   console.log("🏆 Top 10 Highest Opp. Value Items:", sortedItems);
      return sortedItems;
    } catch (error) {
      console.error(
        "❌ Error fetching CRM data:",
        JSON.stringify(error.response?.data || error.message, null, 2)
      );
      return [];
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

  const subjectMatch = aiResponseText.match(/^Subject:\s*(.+)$/m);
  const subject = subjectMatch ? subjectMatch[1] : "No Subject Found";

  const emailBody = aiResponseText.replace(/^Subject:.*?\n\n/, "").trim();
  console.log("Email Body:", emailBody);
//   sendMail("utsab.ghosh@webspiders.com", emailBody, subject, "sourav.bhattacherjee@webspiders.com")

  // console.log("Generated Prompt:", prompt);
};

