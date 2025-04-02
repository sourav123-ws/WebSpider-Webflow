import moment from "moment-timezone";
import axios from "axios";

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;
const OPENAI_API_KEY = process.env.OPEN_API_KEY;

const DEMO_BOARD_ID = "1944965797";

const CREATED_DATE_COLUMN_ID = "date_mknhjdhp";
const TEXT_DATE_COLUMN_ID = "date_mkn218r2";

const STATUS_COLUMN_ID = "status";
const LEAD_SCORE_COLUMN_ID = "numeric_mknst4ys";

const DEALS_COLUMN_ID = "numeric_mknseckr";

const LEAD_SCORE_MAPPING = {
  "New / Unqualified": 10,
  "Marketing qualified": 20,
  Followups: 25,
  "Sales qualified": 40,
  Junk: 0,
  "Closed (Not interested)": 0,
};

const DEAL_LEAD_SCORE_MAPPING = {
  "Pre Quote": 50,
  "Active Negotiation": 65,
  "Quote Given": 80,
  "Closed Won": 100,
  "Closed Lost": 0,
  "Closed No Decision": 0,
};



async function updateScore(itemId, score) {
  const query = `
    mutation {
      change_multiple_column_values(
        board_id: 1944965797, 
        item_id: ${itemId}, 
        column_values: "{\\"numeric_mknseckr\\": \\"${score}\\", \\"color_mknt1t1j\\": \\"0\\"}"
      ) {
        id
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.monday.com/v2",
      { query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
      }
    );

    if (response.data.errors) {
      console.error(
        `❌ Failed to update Score for item ${itemId}:`,
        response.data.errors
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error updating Score for item ${itemId}:`, error.message);
    return false;
  }
}

async function getMondayColumnValue(boardId, pulseId, columnId) {
  try {
    const query = `
           query {
               items(ids: ${pulseId}) {
                   column_values(ids: ["${columnId}"]) {
                       text
                   }
               }
           }
       `;

    const response = await axios.post(
      "https://api.monday.com/v2",
      { query },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
      }
    );

    const columnValue = response.data.data?.items[0]?.column_values[0]?.text;
    return columnValue || null;
  } catch (error) {
    console.error(
      "❌ Error fetching Monday.com column value:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function updateMondayLeadScore(boardId, pulseId, leadScore) {
    try {
      const mutation = `
            mutation {
                change_column_value(
                    board_id: ${boardId}, 
                    item_id: ${pulseId}, 
                    column_id: "${LEAD_SCORE_COLUMN_ID}", 
                    value: "${leadScore}"
                ) {
                    id
                }
            }
        `;
  
      const response = await axios.post(
        "https://api.monday.com/v2",
        { query: mutation },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );
  
      if (response.data.errors) {
        console.error("❌ Monday API Error:", response.data.errors);
        return false;
      }
  
      console.log("✅ Lead Score updated successfully!");
      return response.data.data?.change_column_value?.id ? true : false;
    } catch (error) {
      console.error(
        "❌ Error updating Lead Score in Monday.com:",
        error.response?.data || error.message
      );
      return false;
    }
  }
  
  async function updateMondayDealScore(boardId, pulseId, dealScore) {
    try {
      const mutation = `
            mutation {
                change_column_value(
                    board_id: ${boardId}, 
                    item_id: ${pulseId}, 
                    column_id: "${DEALS_COLUMN_ID}", 
                    value: "${dealScore}"
                ) {
                    id
                }
            }
        `;
  
      const response = await axios.post(
        "https://api.monday.com/v2",
        { query: mutation },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );
  
      if (response.data.errors) {
        console.error("❌ Monday API Error:", response.data.errors);
        return false;
      }
  
      console.log("✅ Deal Score updated successfully!");
      return response.data.data?.change_column_value?.id ? true : false;
    } catch (error) {
      console.error(
        "❌ Error updating Deal Score in Monday.com:",
        error.response?.data || error.message
      );
      return false;
    }
  }

  async function updateMondayDate(boardId, pulseId, formattedDate) {
    try {
      if (!formattedDate) {
        console.error("❌ Invalid formatted date:", formattedDate);
        return false;
      }
  
      const mutation = `
            mutation {
                change_column_value(
                    board_id: ${boardId}, 
                    item_id: ${pulseId}, 
                    column_id: "${CREATED_DATE_COLUMN_ID}", 
                    value: "{\\"date\\":\\"${formattedDate}\\"}"
                ) {
                    id
                }
            }
        `;
  
  
      const response = await axios.post(
        "https://api.monday.com/v2",
        { query: mutation },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );

      if (response.data.errors) {
        console.error("❌ Monday API Error:", response.data.errors);
        return false;
      }
  
      console.log("✅ Created Date updated successfully!");
      return response.data.data?.change_column_value?.id ? true : false;
    } catch (error) {
      console.error(
        "❌ Error updating Monday.com:",
        error.response?.data || error.message
      );
      return false;
    }
  }

function formatDate(dateString) {
  if (!dateString) return null;

  const cleanedDateString = dateString.replace(/\+\d{2}(:\d{2}|\.\d{2})?$/, "");

  let parsedDate = moment.utc(cleanedDateString, moment.ISO_8601, true);
  if (!parsedDate.isValid()) {
    console.error("❌ Invalid date format received:", dateString);
    return null;
  }

  let istDate = parsedDate.tz("Asia/Kolkata");

  const formattedDate = istDate.format("YYYY-MM-DD");

  return formattedDate;
}

async function updateMondayColumn(boardId, itemId, columnId, value) {
  
    const query = `
      mutation {
        change_column_value(
          board_id: ${boardId}, 
          item_id: ${itemId}, 
          column_id: "${columnId}", 
          value: ${JSON.stringify(value)}
        ) {
          id
        }
      }
    `;
  
    try {
      const response = await axios.post(
        "https://api.monday.com/v2",
        { query },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: MONDAY_API_KEY,
          },
        }
      );
  
      if (response.data.errors) {
        console.error(
          "❌ Error updating Monday.com column:",
          response.data.errors
        );
        return false;
      }
  
      console.log("✅ Column updated successfully:", response.data);
      return true;
    } catch (error) {
      console.error("❌ Failed to update column:", error.message);
      return false;
    }
  }

  async function updateMondayDealStage(boardId, pulseId, stage) {
    try {
      const query = `
        mutation {
          change_column_value(
            board_id: ${boardId}, 
            item_id: ${pulseId}, 
            column_id: "color_mknt1t1j", 
            value: "{\\"label\\":\\"${stage}\\"}"
          ) {
            id
          }
        }`;
  
      const response = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
        body: JSON.stringify({ query }),
      });
  
      const data = await response.json();
  
      if (data.errors) {
        console.error("❌ Error updating stage in Monday.com:", data.errors);
        return false;
      }
  
      console.log("✅ Lead stage updated successfully:", stage);
      return true;
    } catch (error) {
      console.error("❌ Exception in updating stage:", error);
      return false;
    }
  }

  async function updateMondayLeadStage(boardId, pulseId, stage) {
    try {
      const query = `
        mutation {
          change_column_value(
            board_id: ${boardId}, 
            item_id: ${pulseId}, 
            column_id: "color_mkntbxq3", 
            value: "{\\"label\\":\\"${stage}\\"}"
          ) {
            id
          }
        }`;
  
      const response = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: MONDAY_API_KEY,
        },
        body: JSON.stringify({ query }),
      });
  
      const data = await response.json();
  
      if (data.errors) {
        console.error("❌ Error updating stage in Monday.com:", data.errors);
        return false;
      }
  
      console.log("✅ Lead stage updated successfully:", stage);
      return true;
    } catch (error) {
      console.error("❌ Exception in updating stage:", error);
      return false;
    }
  }
  

export const mondayWebhooks = async (req, res) => {

  try {
    if (req.body.challenge) {
      return res.json({ challenge: req.body.challenge });
    }

    const event = req.body.event;
    if (!event) {
      return res.status(400).json({ error: "No event data" });
    }

    const { boardId, pulseId, type, columnId, value, previousValue } = event;


    if (!boardId || !pulseId) {
      return res.status(400).json({ error: "Missing boardId or pulseId" });
    }


    if (
      type === "create_pulse" ||
      (type === "change_column_value" && columnId === TEXT_DATE_COLUMN_ID)
    ) {
      let dateText =
        type === "create_pulse"
          ? await getMondayColumnValue(boardId, pulseId, TEXT_DATE_COLUMN_ID)
          : value.text || value;


      if (!dateText || (previousValue && previousValue.text === dateText)) {
        return res
          .status(200)
          .json({ message: "No Date change detected, skipping update" });
      }
      const formattedDate = formatDate(dateText);
      if (!formattedDate) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const updateSuccess = await updateMondayDate(
        boardId,
        pulseId,
        formattedDate
      );
      return res.status(updateSuccess ? 200 : 500).json({
        message: updateSuccess
          ? "Date updated successfully"
          : "Failed to update Created Date",
      });
    }

    // if (
    //   type === "create_pulse" ||
    //   (["change_column_value", "update_column_value"].includes(type) &&
    //     columnId === TEXT_DATE_COLUMN_ID)
    // ) {
    //   console.log("🚀 Entering Date Update Condition...");
    //   console.log(`📌 Event Type: ${type}`);
    //   console.log(`📌 Received columnId: ${columnId}`);
    //   console.log(`📌 Expected TEXT_DATE_COLUMN_ID: ${TEXT_DATE_COLUMN_ID}`);

    //   if (columnId !== TEXT_DATE_COLUMN_ID) {
    //     console.log(
    //       "❌ columnId does NOT match TEXT_DATE_COLUMN_ID, skipping..."
    //     );
    //     return res
    //       .status(400)
    //       .json({ error: "Incorrect column for date update" });
    //   }

    //   // 🔍 Fetching the date text
    //   let dateText =
    //     type === "create_pulse"
    //       ? await getMondayColumnValue(boardId, pulseId, TEXT_DATE_COLUMN_ID)
    //       : value?.text || value;

    //   console.log(`📆 Extracted Date Text: ${dateText}`);

    //   // 🛑 Check if date is missing or unchanged
    //   if (!dateText || (previousValue && previousValue.text === dateText)) {
    //     console.log("⏩ No Date change detected, skipping update.");
    //     return res
    //       .status(200)
    //       .json({ message: "No Date change detected, skipping update" });
    //   }

    //   console.log("✅ Processing Date Update...");

    //   // 🔹 Format the date
    //   const formattedDate = formatDate(dateText);
    //   console.log(`📅 Formatted Date: ${formattedDate}`);

    //   if (!formattedDate) {
    //     console.log("❌ Invalid date format received!");
    //     return res.status(400).json({ error: "Invalid date format" });
    //   }

    //   // ✅ Updating the Created Date column in Monday.com
    //   const updateSuccess = await updateMondayDate(
    //     boardId,
    //     pulseId,
    //     formattedDate
    //   );

    //   if (updateSuccess) {
    //     console.log("✅ Date updated successfully!");
    //     return res.status(200).json({ message: "Date updated successfully" });
    //   } else {
    //     console.log("❌ Failed to update Created Date");
    //     return res.status(500).json({ error: "Failed to update Created Date" });
    //   }
    // }

    if (
      (type === "change_column_value" || type === "update_column_value") &&
      columnId === STATUS_COLUMN_ID
    ) {
      const newStatus = value.label?.text;
      const previousStatus = previousValue?.label?.text;

      if (!newStatus || !(newStatus in LEAD_SCORE_MAPPING)) {
        console.log("❌ Invalid status value, skipping update:", newStatus);
        return res.status(400).json({ error: "Invalid status value" });
      }

      console.log("Inside Date Change field");
      let newLeadScore = LEAD_SCORE_MAPPING[newStatus];
      const previousLeadScore = previousStatus
        ? LEAD_SCORE_MAPPING[previousStatus]
        : null;

      const today = new Date();
      const formattedDate = JSON.stringify({
        date: today.toISOString().split("T")[0],
      });

      // Fetch Last Activity Date from Monday.com
      const lastActivityDate = await getMondayColumnValue(
        boardId,
        pulseId,
        "date_1_mkn8hht7"
      );

      if (lastActivityDate) {
        const lastActivity = new Date(lastActivityDate);
        const diffDays = Math.floor(
          (today - lastActivity) / (1000 * 60 * 60 * 24)
        ); // Difference in days

        if (diffDays > 30) {
          console.log(
            `⏳ Lead is stale! Last activity was ${diffDays} days ago.`
          );

          // Update Active Status to "Stale"
          await updateMondayColumn(
            boardId,
            pulseId,
            "active_status_column_id",
            "Stale"
          );

          // Reduce 10 points from lead score
          newLeadScore = Math.max(0, newLeadScore - 10); // Prevent negative scores
          console.log(
            `📉 Lead Score decreased by 10. New Score: ${newLeadScore}`
          );
        }
      }

      const updateLastActivity = await updateMondayColumn(
        boardId,
        pulseId,
        "date_1_mkn8hht7",
        formattedDate
      );

      if (!updateLastActivity) {
        console.error("❌ Failed to update Last Activity Date");
      } else {
        console.log("✅ Last Activity Date updated successfully!");
      }

      const updateScore = await updateMondayLeadScore(
        boardId,
        pulseId,
        newLeadScore
      );

      if (!updateScore) {
        console.error("❌ Failed to update Lead Score");
        return res.status(500).json({ error: "Failed to update Lead Score" });
      }

      console.log("✅ Lead Score updated successfully!");

      let stage = "";
      if (newLeadScore >= 0 && newLeadScore <= 19) {
        stage = "Cold";
      } else if (newLeadScore >= 20 && newLeadScore <= 49) {
        stage = "Warm";
      }

      console.log(`🔥 Lead is now categorized as: ${stage}`);

      const updateStageSuccess = await updateMondayLeadStage(
        boardId,
        pulseId,
        stage
      );

      if (!updateStageSuccess) {
        console.error("❌ Failed to update Lead Stage");
      } else {
        console.log("✅ Lead Stage updated successfully!");
      }

      return res.status(200).json({
        message:
          "Lead Score, Stage, and Last Activity Date updated successfully",
        previousLeadScore,
        newLeadScore,
        scoreChange: newLeadScore - (previousLeadScore ?? 0),
      });
    }

    if (
      (type === "change_column_value" || type === "update_column_value") &&
      columnId === "deal_stage"
    ) {

      if (!value.label?.text) {
        return res
          .status(200)
          .json({ message: "No valid status change detected." });
      }

      const newStatus = value.label?.text.trim().replace(/\s+/g, " ");

      const previousStatus = previousValue?.label?.text;

      if (!newStatus || !DEAL_LEAD_SCORE_MAPPING.hasOwnProperty(newStatus)) {
        return res.status(400).json({ error: "Invalid status value" });
      }


      const newLeadScore = DEAL_LEAD_SCORE_MAPPING[newStatus];
      const previousLeadScore = previousStatus
        ? DEAL_LEAD_SCORE_MAPPING[previousStatus]
        : null;

      if (previousLeadScore === null) {
        console.log(
          "⚠️ No previous lead score found, setting new score directly."
        );
      } else {
        console.log(
          `🔄 Status changed from "${previousStatus}" to "${newStatus}", Lead Score from ${previousLeadScore} to ${newLeadScore}`
        );

        const scoreChange = newLeadScore - previousLeadScore;

        if (scoreChange < 0) {
          console.log(`📉 Lead Score decreased by ${Math.abs(scoreChange)}`);
        } else if (scoreChange > 0) {
          console.log(`📈 Lead Score increased by ${scoreChange}`);
        } else {
          console.log("🔄 No change in lead score.");
        }
      }

      try {
        const updateSuccess = await updateMondayDealScore(
          DEMO_BOARD_ID,
          pulseId,
          newLeadScore
        );

        console.log(
          `✅ Lead Score Update Status: ${updateSuccess ? "Success" : "Failed"}`
        );

        if (!updateSuccess) {
          return res.status(500).json({
            message: "Failed to update Lead Score",
            previousLeadScore,
            newLeadScore,
            scoreChange: newLeadScore - (previousLeadScore ?? 0),
          });
        }

        // ✅ Now update the stage after lead score is successfully updated
        let stage = "";
        if (newLeadScore < 50) {
          stage = "Cold";
        } else if (newLeadScore >= 50 && newLeadScore <= 79) {
          stage = "Warm";
        } else if (newLeadScore >= 80) {
          stage = "Hot";
        }

        console.log(`🔥 Lead is now categorized as: ${stage}`);

        const updateStageSuccess = await updateMondayDealStage(
          DEMO_BOARD_ID,
          pulseId,
          stage
        );

        if (!updateStageSuccess) {
          console.error("❌ Failed to update stage in Monday.com");
        } else {
          console.log("✅ Stage updated successfully");
        }

        return res.status(200).json({
          message: "Lead Score and Stage updated successfully",
          previousLeadScore,
          newLeadScore,
          scoreChange: newLeadScore - (previousLeadScore ?? 0),
          stage,
        });
      } catch (error) {
        console.error("❌ Error updating Lead Score:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }

    return res.status(200).json({ message: "Ignoring unrelated event" });
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const managerScoreValue = async (req, res) => {

  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }

  const event = req.body.event;

  if (!event || event.type !== "move_pulse_into_board") {
    console.log("⚠️ Webhook ignored: Not an item move event.");
    return res.status(200).json({ message: "Event ignored" });
  }

  if (event.destGroupId !== "topics") {
    return res
      .status(200)
      .json({ message: "Item moved but not into target group." });
  }

  const newItemId = event.pulseId;

  try {
    await updateScore(newItemId, 50);
    res.status(200).json({ message: "Score updated successfully." });
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to update score." });
  }
};
