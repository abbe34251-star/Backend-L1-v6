import express from "express";
import { google } from "googleapis";

const app = express();
app.use(express.json());

const SHEET_ID = process.env.SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

/*
COLUMN MAP:
A = Bord
B = Status (Ledig/Bokat)
C = Tid
D = Antal MAX
E = Antal Gäster
F = Namn
G = Telefon
H = Note
I = Bokad av
J = Datum
*/

app.post("/book_table", async (req, res) => {
  const { date, time, guests, name, phone, note } = req.body;

  try {
    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Bokningar!A2:J500"
    });

    const rows = read.data.values || [];

    let targetRows = [];

    // 1–3 gäster → bord 1–3
    if (guests <= 3) {
      targetRows = rows.filter(r => r[0].includes("Bord 1") || r[0].includes("Bord 2") || r[0].includes("Bord 3"));
    }
    // 4–6 gäster → bord 4–5
    else {
      targetRows = rows.filter(r => r[0].includes("Bord 4") || r[0].includes("Bord 5"));
    }

    // hitta ledigt bord vid rätt tid + datum
    let foundRowIndex = null;

    for (let i = 0; i < targetRows.length; i++) {
      const fullIndex = rows.indexOf(targetRows[i]); // behövs för real rad i sheet
      const [bord, status, rTime, maxGuests, guestCount, rName, rPhone, rNote, bookedBy, rDate] = targetRows[i];

      if (
        status === "Ledig" &&
        rTime === time &&
        rDate === date
      ) {
        foundRowIndex = fullIndex + 2; // +2 pga header
        break;
      }
    }

    if (!foundRowIndex) {
      return res.json({ success: false, message: "Inga lediga bord hittades." });
    }

    // Skicka uppdateringar (bokat + fyll i info)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Bokningar!B${foundRowIndex}:I${foundRowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "Bokat",
            time,
            "", // MAX stays unchanged
            guests,
            name,
            phone,
            note || "",
            "AI"
          ]
        ]
      }
    });

    return res.json({
      success: true,
      message: `Bordet är bokat för ${guests} personer.`,
      row: foundRowIndex
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Backend running...");
});
