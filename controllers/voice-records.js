import dotenv from "dotenv";
dotenv.config();
import axios from "axios";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { completions } from "../openai.js";
import { DateTime } from "luxon";

const API_URL = "https://api.vapi.ai/call";
const BEARER_TOKEN = "e89fc400-61a7-48bf-8400-24ba0983f999";
const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const VODAFONE_BOARD_ID = "1994098789";

const JULY_BOARD_ID = "1994144889";
const JULY_GROUP_ID = "topics";
const JULY_ASSISTANT_ID = "4bad36e4-b5a8-4579-acdf-ea712d1ebf2d";

const ASSISTANT_NAMES = {
  "19fdafcc-48ef-4a72-acd5-ac3536e54e34": "Vodafone Coach: Young Adult – Frustrated",
  "4e09ed1b-539e-46e5-93d8-042fe1669cfd": "Middle-Aged – Confused or Agitated",
  "3dc57ef5-2941-4af6-a4d9-fd96e69cf469": "Senior Citizen – Overwhelmed",
  "9514346e-ea17-48f7-889a-50dea578fe84": "Frequent Traveler – Anxious",
  "fb7c173f-cdc7-4b32-bc7f-772fb4845948": "Business Professional – Impatient",
  "3688bfb9-a12a-4b3e-98a8-f954933bfe07": "Vodafone Customer Unfiltered",
};

const ASSISTANT_IDS = [
  "19fdafcc-48ef-4a72-acd5-ac3536e54e34",
  "4e09ed1b-539e-46e5-93d8-042fe1669cfd",
  "3dc57ef5-2941-4af6-a4d9-fd96e69cf469",
  "9514346e-ea17-48f7-889a-50dea578fe84",
  "fb7c173f-cdc7-4b32-bc7f-772fb4845948",
  "3688bfb9-a12a-4b3e-98a8-f954933bfe07",
];

const ASSISTANT_TO_GROUP_MAPPING = {
  "Vodafone Coach: Young Adult – Frustrated": "topics",
  "Middle-Aged – Confused or Agitated": "group_mkpkzhqz",
  "Senior Citizen – Overwhelmed": "group_mkpkr7k",
  "Frequent Traveler – Anxious": "group_mkpkbgnt",
  "Business Professional – Impatient": "group_mkpkn2ax",
  "Vodafone Customer Unfiltered": "group_mkpk6a8q",
};

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const convertToIST = (utcDate) => {
  return new Date(utcDate).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
};

function convertToEST(dateString) {
  try {
    // Try parsing as ISO format first (UTC)
    if (
      dateString.includes("T") &&
      (dateString.endsWith("Z") || dateString.includes("+"))
    ) {
      const utcDate = DateTime.fromISO(dateString, { zone: "utc" });
      return utcDate
        .setZone("America/New_York")
        .toFormat("MM/dd/yyyy, HH:mm:ss");
    }

    // Try parsing common formats
    const formatsToTry = [
      "dd/MM/yyyy, HH:mm:ss", // 28/03/2025, 03:47:12
      "MM/dd/yyyy, HH:mm:ss", // 03/28/2025, 03:47:12
      "dd/MM/yyyy, hh:mm:ss a", // 28/03/2025, 03:47:12 am
      "MM/dd/yyyy, hh:mm:ss a", // 03/28/2025, 03:47:12 am
      "yyyy-MM-dd HH:mm:ss", // 2025-03-28 03:47:12
      "yyyy-MM-dd'T'HH:mm:ss", // 2025-03-28T03:47:12
    ];

    for (const format of formatsToTry) {
      const parsedDate = DateTime.fromFormat(dateString, format, {
        zone: "utc",
      });
      if (parsedDate.isValid) {
        return parsedDate
          .setZone("America/New_York")
          .toFormat("MM/dd/yyyy, HH:mm:ss");
      }
    }

    throw new Error(`Could not parse date: ${dateString}`);
  } catch (error) {
    console.error("DateTime conversion error:", error);
    return "Invalid date";
  }
}

async function uploadToS3AndGetUrl(fileUrl, bucketName, key) {
  try {
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const fileBuffer = Buffer.from(response.data, "binary");

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: response.headers["content-type"],
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log("✅ File uploaded to S3 successfully");
    const getObjectParams = {
      Bucket: bucketName,
      Key: key,
    };

    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand(getObjectParams),
      {
        expiresIn: 604800,
      }
    );

    return url;
  } catch (error) {
    console.error("❌ Error uploading to S3:", error);
    throw error;
  }
}

const fetchCallsForAssistant = async (assistantId) => {
  try {
    const response = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
      params: { assistantId },
    });
    return response.data || [];
  } catch (error) {
    console.error(
      `❌ Error fetching calls for Assistant ID ${assistantId}:`,
      error.response?.data || error.message
    );
    return [];
  }
};

const createMondayItem = async (callData) => {
  const sanitize = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
  };

  const assistantName =
    ASSISTANT_NAMES[callData.assistantId] || "Unknown Assistant";
  const groupId = ASSISTANT_TO_GROUP_MAPPING[assistantName];

  try {
    // Upload recording to S3 and get URL
    let s3RecordingUrl = "No recording";
    if (callData.recordingUrl) {
      const s3Key = `recordings/${callData.id}.mp3`;
      s3RecordingUrl = await uploadToS3AndGetUrl(
        callData.recordingUrl,
        "spiderx-phoneai-call-recordings",
        s3Key
      );
    }
    // Prepare column values with S3 URL
    const columnValues = {
      name: sanitize(callData.id),
      text_mkpkbprc: sanitize(convertToIST(callData.startedAt)),
      text_mkpks5e6: sanitize(convertToIST(callData.endingTime)),
      text_mkpkqb2r: sanitize(callData.endedReason),
      text_mkpkcsbe: sanitize(s3RecordingUrl),
      long_text_mkpmbyb2: sanitize(callData.shortSummary) || "N/A",
      long_text_mkpmq3sq: sanitize(callData.summary) || "N/A",
    };

    // Rest of your function remains the same...
    const columnValuesStr = JSON.stringify(columnValues)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const query = `mutation {
      create_item(
        board_id: ${VODAFONE_BOARD_ID},
        item_name: "${sanitize(callData.id)}",
        group_id: "${groupId}",
        column_values: "${columnValuesStr}"
      ) {
        id
      }
    }`;

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      {
        headers: {
          Authorization: `Bearer ${MONDAY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Item created in Monday.com:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error creating item in Monday.com:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export const fetchAndSaveLatestCallsToMonday = async () => {
  let allCalls = [];

  for (const assistantId of ASSISTANT_IDS) {
    const calls = await fetchCallsForAssistant(assistantId);
    allCalls = [...allCalls, ...calls];
  }

  allCalls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (allCalls.length > 0) {
    allCalls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const call of allCalls) {
      let shortSummary = "N/A";

      if (call.summary) {
        const messages = [
          {
            role: "system",
            content: `Summarize the following call details concisely using numbered points. Ensure each point is clearly separated for readability in Monday.com by using emojis.
        
            1️⃣ 
            2️⃣ 
            3️⃣ 

            like that
        
            Use these emojis (1️⃣, 2️⃣, 3️⃣) to ensure separation is visually clear in Monday.com.`,
          },
          { role: "user", content: call.summary },
        ];

        const aiResponse = await completions(messages);
        if (aiResponse.status === 0 && aiResponse.data) {
          // Convert AI response to HTML
          const plainSummary = aiResponse.data;
          shortSummary = plainSummary
            .split("\n") // Split by new lines
            .map((line) => `<strong>${line.trim()}</strong><br>`) // Make each line bold with <br>
            .join(""); // Join as HTML string
        }
      }

      const callData = {
        id: call.id,
        startedAt: call.startedAt,
        assistantId: call.assistantId,
        endedReason: call.endedReason,
        recordingUrl: call.recordingUrl,
        startingTime: call.startedAt,
        endingTime: call.endedAt,
        shortSummary: shortSummary,
        summary: call.summary,
      };

      await createMondayItem(callData);
    }
  } else {
    console.log("❌ No July calls found.");
  }
};

//inserting july Data

const createJulyMondayItem = async (callData) => {
  const sanitize = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
  };

  try {
    let s3RecordingUrl = "No recording";
    if (callData.recordingUrl) {
      const s3Key = `recordings/july/${callData.id}.mp3`;
      s3RecordingUrl = await uploadToS3AndGetUrl(
        callData.recordingUrl,
        "spiderx-phoneai-call-recordings",
        s3Key
      );
    }

    // Prepare column values matching your July board structure
    const columnValues = {
      name: sanitize(callData.id),
      text_mkpkvz3n: sanitize(callData.endedReason),
      text_mkpk3zzz: sanitize(convertToEST(callData.startedAt)),
      text_mkpk8n7p: sanitize(s3RecordingUrl),
      text_mkpkxzyf: sanitize(convertToEST(callData.endingTime)),
      long_text_mkpmxjcp: sanitize(callData.shortSummary || "N/A"),
      long_text_mkpmy75m: sanitize(callData.summary || "N/A"),
    };

    const columnValuesStr = JSON.stringify(columnValues)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const query = `mutation {
      create_item(
        board_id: ${JULY_BOARD_ID},
        item_name: "${sanitize(callData.id)}",
        group_id: "${JULY_GROUP_ID}",
        column_values: "${columnValuesStr}"
      ) {
        id
      }
    }`;

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      {
        headers: {
          Authorization: `Bearer ${MONDAY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ July item created in Monday.com:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error creating July item in Monday.com:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Modified main function to handle July data
export const fetchAndSaveLatestJulyCallsToMonday = async () => {
  const julyCalls = await fetchCallsForAssistant(JULY_ASSISTANT_ID);

  if (julyCalls.length > 0) {
    julyCalls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const call of julyCalls) {
      let shortSummary = "N/A";

      if (call.summary) {
        const messages = [
          {
            role: "system",
            content: `Summarize the following call details concisely using numbered points. Ensure each point is clearly separated for readability in Monday.com by using emojis.
        
            1️⃣ 
            2️⃣ 
            3️⃣ 

            like that
        
            Use these emojis (1️⃣, 2️⃣, 3️⃣) to ensure separation is visually clear in Monday.com.`,
          },
          { role: "user", content: call.summary },
        ];

        const aiResponse = await completions(messages);
        if (aiResponse.status === 0 && aiResponse.data) {
          // Convert AI response to HTML
          const plainSummary = aiResponse.data;
          shortSummary = plainSummary
            .split("\n") // Split by new lines
            .map((line) => `<strong>${line.trim()}</strong><br>`) // Make each line bold with <br>
            .join(""); // Join as HTML string
        }
      }

      const callData = {
        id: call.id,
        startedAt: call.startedAt,
        assistantId: call.assistantId,
        endedReason: call.endedReason,
        recordingUrl: call.recordingUrl,
        startingTime: call.startedAt,
        endingTime: call.endedAt,
        shortSummary: shortSummary,
        summary: call.summary,
      };

      await createJulyMondayItem(callData);
    }
    console.log(
      `✅ Successfully inserted ${julyCalls.length} July records into Monday.com!`
    );
  } else {
    console.log("❌ No July calls found.");
  }
};

//webhook function

export const insertThroughWebhook = async (req, res) => {
  
  const sanitize = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
  };

  try {
    let assistant, startedAt, endedAt, endedReason, recordingUrl, summary, call;

    if (req.body.message) {
      ({
        assistant,
        startedAt,
        endedAt,
        endedReason = "Unknown",
        recordingUrl = "N/A",
        summary = "No Summary",
        call = {},
      } = req.body.message);
    } else {
      ({
        assistant = null,
        startedAt = null,
        endedAt = null,
        endedReason = "Unknown",
        recordingUrl = "N/A",
        summary = "No Summary",
        call = {},
      } = req.body);
    }

    const assistantId = assistant?.id || "Unknown Assistant ID";
    console.log(
      assistantId,
      startedAt,
      endedAt,
      endedReason,
      recordingUrl,
      summary,
      call
    );

    const id = call.id;

    // Determine board and group configuration
    const isVodafoneAssistant = ASSISTANT_IDS.includes(assistantId);
    const boardId = isVodafoneAssistant ? VODAFONE_BOARD_ID : JULY_BOARD_ID;
    const assistantName = ASSISTANT_NAMES[assistantId] || "Unknown Assistant";
    console.log(assistantName);
    const groupId = isVodafoneAssistant
      ? ASSISTANT_TO_GROUP_MAPPING[assistantName] || "topics"
      : JULY_GROUP_ID;
    console.log(groupId);
    // Generate short summary
    let shortSummary = "N/A";
    let csatScore = "N/A";

    if (summary) {
      const messages = [
        {
          role: "system",
          content: `Summarize the following call details concisely using numbered points. Ensure each point is clearly separated for readability in Monday.com by using emojis.
          
          1️⃣ 
          2️⃣ 
          3️⃣ 
          
          like that
          
          Use these emojis (1️⃣, 2️⃣, 3️⃣) to ensure separation is visually clear in Monday.com.`,
        },
        { role: "user", content: summary },
      ];

      const aiResponse = await completions(messages);
      if (aiResponse.status === 0 && aiResponse.data) {
        shortSummary = aiResponse.data
          .split("\n")
          .map((line) => `<strong>${line.trim()}</strong><br>`)
          .join("");
      }
    }


    const csatMessages = [
      {
        role: "system",
        content: "Extract just the CSAT score (a number between 1-5) from the conversation. Return only the number with no additional text."
      },
      { role: "user", content: summary }
    ];

    const csatResponse = await completions(csatMessages);
    if (csatResponse.status === 0 && csatResponse.data) {
      const scoreMatch = csatResponse.data.match(/[1-5]/);
      if (scoreMatch) {
        csatScore = scoreMatch[0];
      }
    }

    // Upload recording if available
    let s3RecordingUrl = "No recording";
    console.log(recordingUrl);
    if (recordingUrl) {
      const folder = isVodafoneAssistant ? "" : "july/";
      const s3Key = `recordings/${folder}${id}.mp3`;
      s3RecordingUrl = await uploadToS3AndGetUrl(
        recordingUrl,
        "spiderx-phoneai-call-recordings",
        s3Key
      );
    }

    // Prepare column values based on board type
    const columnValues = isVodafoneAssistant
      ? {
          name: sanitize(id),
          text_mkpkbprc: sanitize(convertToIST(startedAt)),
          text_mkpks5e6: sanitize(convertToIST(endedAt)),
          text_mkpkqb2r: sanitize(endedReason),
          text_mkpkcsbe: sanitize(s3RecordingUrl),
          long_text_mkpmq3sq: sanitize(summary || "N/A"),
          long_text_mkpmbyb2: sanitize(shortSummary),
        }
      : {
          name: sanitize(id),
          text_mkpkvz3n: sanitize(endedReason),
          text_mkpk3zzz: sanitize(convertToEST(startedAt)),
          text_mkpk8n7p: sanitize(s3RecordingUrl),
          text_mkpkxzyf: sanitize(convertToEST(endedAt)),
          long_text_mkpmxjcp: sanitize(shortSummary),
          long_text_mkpmy75m: sanitize(summary || "N/A"),
          text_mkpnfqn9 : `${sanitize(csatScore)}/5`
        };

    // Prepare Monday.com API request
    const columnValuesStr = JSON.stringify(columnValues)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const query = `mutation {
      create_item(
        board_id: ${boardId},
        item_name: "${sanitize(id)}",
        group_id: "${groupId}",
        column_values: "${columnValuesStr}"
      ) {
        id
      }
    }`;

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      {
        headers: {
          Authorization: `Bearer ${MONDAY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `✅ Item created in Monday.com (Board: ${boardId}, Group: ${groupId})`
    );
    res.status(200).json({
      success: true,
      data: response.data,
      boardId,
      groupId,
    });
  } catch (error) {
    console.error(
      "❌ Error processing webhook:",
      error.response?.data || error.message
    );
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
};
