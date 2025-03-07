import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import moment from "moment-timezone";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;

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

if (!MONDAY_API_KEY || !BOARD_ID || !GROUP_ID) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

async function updateMondayLeadStage(boardId, pulseId, stage) {
  console.log("Board pulse stage", boardId, pulseId, stage);
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

async function updateMondayColumn(boardId, itemId, columnId, value) {
  console.log(boardId, itemId, columnId, value);

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

    console.log("Response", response.data);

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

const mapWebflowFields = (formName, formData, submittedAt) => {
  let mappedData = { date: new Date(submittedAt).toISOString().split("T")[0] };
  console.log("form data", formData);
  mappedData = {
    ...mappedData,
    lead:
      formData["Name"] ||
      formData["Full Name"] ||
      (formData["First Name"] && formData["Last Name"]
        ? `${formData["First Name"]} ${formData["Last Name"]}`
        : "User"),
    company: formData["Company"] || "N/A",
    email: formData["Email"] || formData["Contact Email"] || "N/A",
    phone:
      formData["Phone"] ||
      formData["Phone 2"] ||
      formData["Contact No"] ||
      "N/A",
    message:
      formData["Message"] ||
      formData["Tell us what you are trying to build"] ||
      "N/A",
    source: formData["Form Source"] || "N/A",
    referral_url: formData["URL"] || "N/A",
  };

  console.log("Mapped Data", mappedData);
  return mappedData;
};

// webflow-webhook

app.post("/webflow-webhook", async (req, res) => {
  console.log("✅ Webflow Webhook Received!");

  const { payload } = req.body;
  if (!payload) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid payload structure" });
  }

  const formName = payload.name || "Unknown Form";
  const formData = payload.data || {};
  const submittedAt = payload.submittedAt || new Date().toISOString();

  console.log(`📌 Form Submitted: ${formName}`);

  const mappedData = mapWebflowFields(formName, formData, submittedAt);
  console.log("📝 Mapped Data:", mappedData);

  const columnValues = {
    date4: mappedData.date,
    text_mknfkez9: mappedData.email,
    text_mknfphdb: mappedData.phone,
    text_mknf6w0k: mappedData.company || "",
    long_text_mkng2j3v: mappedData.message,
    text_mknh2vcq: mappedData.source,
    long_text_mknqqja7: mappedData.referral_url,
    status: { label: "New" },
  };

  const query = `
    mutation {
      create_item (
        board_id: ${BOARD_ID}, 
        group_id: "${GROUP_ID}",
        item_name: "${mappedData.lead}",
        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
      ) {
        id
      }
    }`;

  try {
    const response = await axios.post(
      "https://api.monday.com/v2",
      { query },
      {
        headers: {
          Authorization: MONDAY_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Data saved to Monday.com:", response.data);
    res
      .status(200)
      .json({ success: true, message: `Received and saved form: ${formName}` });
  } catch (error) {
    console.error(
      "❌ Error saving to Monday.com:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      message: "Error saving to Monday.com",
      error: error.response?.data || error.message,
    });
  }
});

//date-conversion
app.post("/monday-webhook", async (req, res) => {
  try {
    if (req.body.challenge) {
      return res.json({ challenge: req.body.challenge });
    }

    const event = req.body.event;
    if (!event) {
      return res.status(400).json({ error: "No event data" });
    }

    const { boardId, pulseId, type, columnId, value, previousValue } = event;

    // console.log("🛠️ Debugging columnId before condition check:", columnId);
    // console.log("✅ Expected column ID for Lead Score:", LEAD_SCORE_COLUMN_ID);
    // console.log("✅ Event Type:", type);

    if (!boardId || !pulseId) {
      return res.status(400).json({ error: "Missing boardId or pulseId" });
    }

    // ✅ Date Change Handling
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

      // console.log("📝 Updating Created Date column...");
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

    // ✅ Status Change Handling
    // if (
    //   (type === "change_column_value" || type === "update_column_value") &&
    //   columnId === STATUS_COLUMN_ID
    // ) {
    //   const newStatus = value.label?.text;
    //   const previousStatus = previousValue?.label?.text;

    //   if (!newStatus || !(newStatus in LEAD_SCORE_MAPPING)) {
    //     console.log("❌ Invalid status value, skipping update:", newStatus);
    //     return res.status(400).json({ error: "Invalid status value" });
    //   }

    //   const newLeadScore = LEAD_SCORE_MAPPING[newStatus];
    //   const previousLeadScore = previousStatus
    //     ? LEAD_SCORE_MAPPING[previousStatus]
    //     : null; // Get previous score

    //   console.log(
    //     `🔄 Status changed from ${previousStatus} to ${newStatus}, Lead Score from ${previousLeadScore} to ${newLeadScore}`
    //   );

    //   // ✅ Update "Last Activity Date" to today's date
    //   const today = new Date().toISOString().split("T")[0];
    //   const formattedDate = JSON.stringify({ date: today });

    //   const updateLastActivity = await updateMondayColumn(
    //     boardId,
    //     pulseId,
    //     "date_1_mkn8hht7", // Last Activity Date column ID
    //     formattedDate
    //   );

    //   if (!updateLastActivity) {
    //     console.error("❌ Failed to update Last Activity Date");
    //   } else {
    //     console.log("✅ Last Activity Date updated successfully!");
    //   }

    //   // ✅ Update Lead Score
    //   const updateScore = await updateMondayLeadScore(
    //     boardId,
    //     pulseId,
    //     newLeadScore
    //   );
    //   if (!updateScore) {
    //     console.error("❌ Failed to update Lead Score");
    //     return res.status(500).json({ error: "Failed to update Lead Score" });
    //   }
    //   console.log("✅ Lead Score updated successfully!");

    //   // ✅ Update Lead Stage after Lead Score update
    //   let stage = "";
    //   if (newLeadScore >= 0 && newLeadScore <= 19) {
    //     stage = "Cold";
    //   } else if (newLeadScore >= 20 && newLeadScore <= 49) {
    //     stage = "Warm";
    //   }

    //   console.log(`🔥 Lead is now categorized as: ${stage}`);

    //   const updateStageSuccess = await updateMondayLeadStage(
    //     boardId,
    //     pulseId,
    //     stage
    //   );
    //   if (!updateStageSuccess) {
    //     console.error("❌ Failed to update Lead Stage");
    //   } else {
    //     console.log("✅ Lead Stage updated successfully!");
    //   }

    //   const lastActivityDate = new Date(today);
    //   const thirtyDaysAgo = new Date();
    //   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    //   console.log(
    //     `🛠️ Checking for Stale Status: Last Activity ${lastActivityDate}, Threshold: ${thirtyDaysAgo}`
    //   );

    //   if (lastActivityDate <= thirtyDaysAgo) {
    //     // ✅ Corrected condition
    //     console.log(
    //       "⚠️ Lead is stale! Updating Active Status & Deducting Lead Score."
    //     );

    //     // Update "Active Status" to Stale
    //     const updateStatus = await updateMondayColumn(
    //       boardId,
    //       pulseId,
    //       "color_mkntydxy", // Active Status column
    //       JSON.stringify({ label: "Stale" }) // ✅ Ensure correct JSON format
    //     );

    //     if (!updateStatus) {
    //       console.error("❌ Failed to update Active Status to Stale");
    //     } else {
    //       console.log("✅ Active Status updated to Stale!");
    //     }

    //     // Deduct 10 points from Lead Score
    //     const newStaleLeadScore = Math.max(newLeadScore - 10, 0);
    //     const updateLeadScore = await updateMondayLeadScore(
    //       boardId,
    //       pulseId,
    //       newStaleLeadScore
    //     );

    //     if (!updateLeadScore) {
    //       console.error("❌ Failed to deduct points from Lead Score");
    //     } else {
    //       console.log("✅ Lead Score deducted by 10 due to Stale status!");
    //     }
    //   }

    //   return res.status(200).json({
    //     message:
    //       "Lead Score, Stage, Last Activity Date, and Stale Status updated successfully",
    //     previousLeadScore,
    //     newLeadScore,
    //     scoreChange: newLeadScore - (previousLeadScore ?? 0),
    //   });
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
      console.log("🚀 Triggered status update event!");

      console.log(`📌 Event Type: ${type}`);
      console.log(`📋 Column ID: ${columnId} (Expected: ${STATUS_COLUMN_ID})`);

      if (!value.label?.text) {
        console.log("⚠️ Empty status received, skipping update.");
        return res.status(200).json({ message: "No valid status change detected." });
      }

      const newStatus = value.label?.text.trim().replace(/\s+/g, " ");

      console.log("🆕 Normalized New Status:", newStatus);
      const previousStatus = previousValue?.label?.text;

      console.log("🆕 New Status:", newStatus);
      console.log("📜 Previous Status:", previousStatus);

      console.log("🔹 Full Webhook Payload:", JSON.stringify(req.body, null, 2));
      console.log("🔹 Checking value.label:", value?.label);
      console.log("🔹 Checking previousValue.label:", previousValue?.label);


      if (!newStatus || !DEAL_LEAD_SCORE_MAPPING.hasOwnProperty(newStatus)) {
        console.log("❌ Invalid or missing status value, skipping update. Received:", newStatus);
        return res.status(400).json({ error: "Invalid status value" });
      }

      console.log("✅ Valid status detected, processing update...");

      const newLeadScore = DEAL_LEAD_SCORE_MAPPING[newStatus];
      const previousLeadScore = previousStatus
        ? DEAL_LEAD_SCORE_MAPPING[previousStatus]
        : null;

      console.log("📊 Lead Score Mapping:", DEAL_LEAD_SCORE_MAPPING);
      console.log(`🎯 New Lead Score: ${newLeadScore}`);
      console.log(`📉 Previous Lead Score: ${previousLeadScore}`);

      if (previousLeadScore === null) {
        console.log(
          "⚠️ No previous lead score found, setting new score directly."
        );
      } else {
        console.log(
          `🔄 Status changed from "${previousStatus}" to "${newStatus}", Lead Score from ${previousLeadScore} to ${newLeadScore}`
        );

        const scoreChange = newLeadScore - previousLeadScore;
        console.log(`📊 Score Change: ${scoreChange}`);

        if (scoreChange < 0) {
          console.log(`📉 Lead Score decreased by ${Math.abs(scoreChange)}`);
        } else if (scoreChange > 0) {
          console.log(`📈 Lead Score increased by ${scoreChange}`);
        } else {
          console.log("🔄 No change in lead score.");
        }
      }

      console.log(
        `📋 Updating Lead Score for Pulse ID: ${pulseId}, Board ID: ${DEMO_BOARD_ID}`
      );

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
});

async function getItemsInGroup(boardId, groupId) {
  const query = `
    query {
      boards(ids: ${boardId}) {
        groups(ids: "${groupId}") {
          items_page {
            items {
              id
              name
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.monday.com/v2",
      { query },
      {
        headers: {
          Authorization: MONDAY_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const items = response.data.data.boards[0]?.groups[0]?.items_page?.items || [];

    console.log("Items in group:", items);

    return items;
  } catch (error) {
    console.error("Error fetching items:", error.message);
    return [];
  }
}

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

    console.log(`✅ Score updated to ${score} for item ${itemId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating Score for item ${itemId}:`, error.message);
    return false;
  }
}

app.post("/manage-score-value", async (req, res) => {
  console.log("🔹 Full Webhook Payload:", JSON.stringify(req.body, null, 2));

  if (req.body.challenge) {
    console.log("🔹 Responding to challenge...");
    return res.json({ challenge: req.body.challenge });
  }

  const event = req.body.event;

  // Check if the event is a "move_pulse_into_board" (item moved into the board)
  if (!event || event.type !== "move_pulse_into_board") {
    console.log("⚠️ Webhook ignored: Not an item move event.");
    return res.status(200).json({ message: "Event ignored" });
  }

  // Ensure the item is moved into the "topics" group
  if (event.destGroupId !== "topics") {
    console.log(`⚠️ Item moved, but not into 'topics'. Ignoring.`);
    return res.status(200).json({ message: "Item moved but not into target group." });
  }

  const newItemId = event.pulseId;
  console.log(`✅ Item ${newItemId} moved into 'topics'. Updating score...`);

  try {
    await updateScore(newItemId, 50);
    console.log(`✅ Score updated to 50 for item ${newItemId}`);
    res.status(200).json({ message: "Score updated successfully." });
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to update score." });
  }
});





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

    console.log("📡 Fetching column value from Monday.com...");
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

function formatDate(dateString) {
  if (!dateString) return null;

  console.log("📥 Received date for formatting:", dateString);

  const cleanedDateString = dateString.replace(/\+\d{2}(:\d{2}|\.\d{2})?$/, "");
  console.log("🔄 Cleaned Date String:", cleanedDateString);

  let parsedDate = moment.utc(cleanedDateString, moment.ISO_8601, true);
  if (!parsedDate.isValid()) {
    console.error("❌ Invalid date format received:", dateString);
    return null;
  }

  let istDate = parsedDate.tz("Asia/Kolkata");

  const formattedDate = istDate.format("YYYY-MM-DD");
  console.log("✅ Final Formatted Date (IST):", formattedDate);

  return formattedDate;
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

    console.log("📡 Sending Lead Score update to Monday.com:", mutation);

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

    console.log(
      "✅ Monday API Response:",
      JSON.stringify(response.data, null, 2)
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

//NEW
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

    console.log("📡 Sending Deal Score update to Monday.com:", mutation);

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

    console.log(
      "✅ Monday API Response:",
      JSON.stringify(response.data, null, 2)
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

    console.log("📡 Sending update to Monday.com:", mutation);

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

    console.log(
      "✅ Monday API Response:",
      JSON.stringify(response.data, null, 2)
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Webhook listening on port ${PORT}`);
});
