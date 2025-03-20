
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

const BOARD_ID = process.env.BOARD_ID;
const GROUP_ID = process.env.GROUP_ID;
const RECRUITMENT_BOARD_ID = "1985428531"
const PRATAM_GROUP_ID = "group_mkp4wtg0"


if (!MONDAY_API_KEY || !BOARD_ID || !GROUP_ID) {
  console.error("❌ Missing environment variables!");
  process.exit(1);
}

const mapWebflowFields = (formName, formData, submittedAt) => {
  let mappedData = { date: new Date(submittedAt).toISOString().split("T")[0] };
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

  return mappedData;
};

export const webflowWebhooks = async (req, res) => {

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
  console.log("Mapped Data",mappedData);

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

    res
      .status(200)
      .json({ success: true, message: `Received and saved form: ${formName}` });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error saving to Monday.com",
      error: error.response?.data || error.message,
    });
  }
};

export const getRecruitmentDetails = async (req, res) => {
  console.log("HERE");
  try {
    const formData = req.body.payload.data;
    console.log("FROM DATA",formData);
    if (formData.JobTitle !== "Pratham 2.0 - An Exclusive Fresh Tech Talent Hiring Program") {
      return res.status(200).json({ message: "Form name does not match, no action taken." });
    }

    const columnValues = {
      "text_mkp06g1n": formData.Name || "", // Name
      "email_mkp0w299": { "email": formData.Email, "text": formData.Email } || "", // Email
      "text_mkp5zamf": `${formData["Dial code"].replace("+", "")}${formData.Phone}`,
      // "numeric_mkp0j2f7": `${formData["Dial code"]} ${formData.Phone || ""}`,
      "text_mkp01p06": formData.Resume || "",
      "text_mkp0rre7": formData.CurrentLocation || "",
      "text_mkp0rydz": formData.PreferredLocation === "Kolkata" ? "Yes" : "No", // Willing to relocate
      "text_mkp58z25": formData.PreferredLocation || "",
      "text_mkp5q2c3": formData.CurrentCTC || "",
      "text_mkp5rvwx": formData.ExpectedCTC || "",
      "text_mkp5qvz4": formData.NoticePeriod || "",
      "text_mkp5kmdy": formData.Company || "" 
    };
    console.log("Column Values",columnValues.numeric_mkp0j2f7);
    const mutation = `
    mutation {
      create_item (
        board_id: ${RECRUITMENT_BOARD_ID},
        group_id: "${PRATAM_GROUP_ID}",
        item_name: "${formData.Name}",
        column_values: "${JSON.stringify(columnValues).replace(/"/g, '\\"')}"
      ) {
        id
      }
    }`;

    fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.MONDAY_API_KEY
      },
      body: JSON.stringify({
        query: mutation
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.errors) {
          console.error("Monday API Errors:", data.errors);
          res.status(400).json({ error: "Monday API error", details: data.errors });
        } else {
          console.log("Monday API Response:", data);
          res.status(200).json({ success: true, itemId: data.data.create_item.id });
        }
      })
      .catch(error => {
        console.error("Fetch error:", error);
        res.status(500).json({ error: "Internal Server Error" });
      });

  } catch (error) {
    console.error("Error sending data to Monday.com:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

