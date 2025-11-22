import express from "express";
import { google } from "googleapis";

const app = express();
app.use(express.json());

// Google Sheet ID (lägg in i Render ENV)
const SHEET_ID = process.env.SHEET_ID;

// Google auth (lägg JSON i Render ENV)
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// Vapi Tool Backend Endpoint
app.post("/check_and_book_table", async (req, res) => {
  try {
    const { date, time, guests } = req.body;

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Bokningar!A2:D200"
    });

    const rows = read.data.values || [];
    let match = null;

    for (let i = 0; i < rows.length; i++) {
      const [rDate, rTime, table, status] = rows[i];

      if (rDate === date && rTime === time && status === "ledig") {
        match = { rowIndex: i + 2, table };
        break;
      }
    }

    if (!match) {
      return res.json({
        success: false,
        message: "Inga lediga bord hittades."
      });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Bokningar!D${match.rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [["bokad"]] }
    });

    res.json({
      success: true,
      table: match.table,
      message: `Bord ${match.table} är bokat.`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Backend running...");
});
