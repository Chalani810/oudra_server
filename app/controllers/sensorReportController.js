const PDFDocument = require("pdfkit");
const SensorData = require("../models/SensorData");

const generateSensorReport = async (req, res) => {
  let doc;
  try {
    const now = new Date();
    const reportDate = now.toLocaleDateString();
    const reportTime = now.toLocaleTimeString();

    const allData = await SensorData.find().sort({ recordedAt: -1 }).lean();

    if (!allData.length) {
      return res.status(404).json({ error: "No sensor data found" });
    }

    // Latest reading per tree
    const latestPerTree = {};
    allData.forEach((record) => {
      if (
        !latestPerTree[record.treeId] ||
        new Date(latestPerTree[record.treeId].recordedAt) < new Date(record.recordedAt)
      ) {
        latestPerTree[record.treeId] = record;
      }
    });

    const treeRows = Object.values(latestPerTree).sort((a, b) =>
      a.treeId.localeCompare(b.treeId)
    );

    const statusCounts = { Normal: 0, Warning: 0, Critical: 0 };
    treeRows.forEach((t) => {
      if (statusCounts[t.overallStatus] !== undefined) statusCounts[t.overallStatus]++;
    });

    const totalTrees = treeRows.length;

    // PDF init
    doc = new PDFDocument({ margin: 40, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Oudra_Sensor_Report_" + now.getTime() + ".pdf"
    );
    doc.pipe(res);

    const GREEN  = "#2e7d32";
    const BLACK  = "#1a1a1a";
    const GRAY   = "#555555";
    const LGRAY  = "#aaaaaa";
    const PAGE_W = 515;

    // =========================================================================
    // HEADER  (all absolute Y coords — no doc.y used in header)
    // =========================================================================
    doc
      .fillColor(GREEN)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("Oudra", 40, 40, { continued: true })
      .fillColor(BLACK)
      .font("Helvetica")
      .fontSize(13)
      .text("  |  IoT Sensor Report", { continued: false });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(LGRAY)
      .text(
        "Decision Support System for Agarwood Plantation   |   Generated on " + reportDate + " at " + reportTime,
        40, 68
      );

    doc
      .moveTo(40, 82)
      .lineTo(555, 82)
      .strokeColor(GREEN)
      .lineWidth(1.2)
      .stroke();

    // =========================================================================
    // REPORT TITLE
    // =========================================================================
    doc
      .fillColor(BLACK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("Agarwood Tree Sensor Summary", 40, 94);

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(GRAY)
      .text("Report generated: " + now.toLocaleString(), 40, 110);

    // =========================================================================
    // STATUS SUMMARY BOXES  (all absolute coords)
    // =========================================================================
    const BOX_TOP = 130;
    const BOX_W   = 148;
    const BOX_H   = 50;
    const GAP     = 10;

    const drawBox = (x, bgColor, borderColor, label, count) => {
      doc.rect(x, BOX_TOP, BOX_W, BOX_H).fillColor(bgColor).fill();
      doc.rect(x, BOX_TOP, BOX_W, BOX_H).strokeColor(borderColor).lineWidth(0.8).stroke();
      doc
        .fillColor(borderColor)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(count.toString(), x, BOX_TOP + 6, { width: BOX_W, align: "center" });
      doc
        .fillColor(BLACK)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(label, x, BOX_TOP + 30, { width: BOX_W, align: "center" });
    };

    drawBox(40,                     "#f0faf0", "#2e7d32", "NORMAL",   statusCounts.Normal);
    drawBox(40 + BOX_W + GAP,       "#fffde7", "#f9a825", "WARNING",  statusCounts.Warning);
    drawBox(40 + (BOX_W + GAP) * 2, "#fef2f2", "#c62828", "CRITICAL", statusCounts.Critical);

    // Total Trees label — right of boxes
    const totalX = 40 + (BOX_W + GAP) * 3 + 8;
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .fontSize(7.5)
      .text("Total Trees", totalX, BOX_TOP + 8, { width: 88 });
    doc
      .fillColor(BLACK)
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(totalTrees.toString(), totalX, BOX_TOP + 20, { width: 88 });

    // =========================================================================
    // MAIN DATA TABLE  — starts at fixed Y below boxes
    // =========================================================================
    const DIVIDER_Y   = BOX_TOP + BOX_H + 14;
    const TITLE_Y     = DIVIDER_Y + 4;
    const TABLE_HDR_Y = TITLE_Y + 16;

    doc
      .moveTo(40, DIVIDER_Y)
      .lineTo(555, DIVIDER_Y)
      .strokeColor("#dddddd")
      .lineWidth(0.6)
      .stroke();

    doc
      .fillColor(BLACK)
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text("All Trees - Latest Sensor Readings", 40, TITLE_Y);

    const cols = [
      { label: "Tree ID",       x: 40,  w: 70  },
      { label: "Temp (C)",      x: 110, w: 55  },
      { label: "Humidity %",    x: 165, w: 55  },
      { label: "Soil pH",       x: 220, w: 48  },
      { label: "Moisture %",    x: 268, w: 62  },
      { label: "Status",        x: 330, w: 58  },
      { label: "Last Recorded", x: 388, w: 167 },
    ];

    const HDR_H = 15;
    const ROW_H = 13;

    const drawTableHeader = (startY) => {
      doc.rect(40, startY, PAGE_W, HDR_H).fillColor("#eeeeee").fill();
      doc.moveTo(40, startY).lineTo(555, startY).strokeColor("#cccccc").lineWidth(0.5).stroke();
      doc.moveTo(40, startY + HDR_H).lineTo(555, startY + HDR_H).strokeColor("#cccccc").lineWidth(0.5).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLACK);
      cols.forEach((c) => {
        doc.text(c.label, c.x + 2, startY + 4, { width: c.w - 4 });
      });
      return startY + HDR_H;
    };

    let rowY = drawTableHeader(TABLE_HDR_Y);

    treeRows.forEach((row, idx) => {
      if (rowY > 745) {
        doc.addPage();
        rowY = drawTableHeader(40);
      }

      if (idx % 2 === 0) {
        doc.rect(40, rowY, PAGE_W, ROW_H).fillColor("#f9f9f9").fill();
      }

      doc.moveTo(40, rowY + ROW_H).lineTo(555, rowY + ROW_H).strokeColor("#eeeeee").lineWidth(0.3).stroke();

      const ph = row.soilPh && row.soilPh !== 0 ? String(row.soilPh) : "-";

      doc.font("Helvetica").fontSize(7.5).fillColor(BLACK);
      doc.text(row.treeId,               cols[0].x + 2, rowY + 3, { width: cols[0].w - 4 });
      doc.text(String(row.temperature),  cols[1].x + 2, rowY + 3, { width: cols[1].w - 4 });
      doc.text(String(row.humidity),     cols[2].x + 2, rowY + 3, { width: cols[2].w - 4 });
      doc.text(ph,                       cols[3].x + 2, rowY + 3, { width: cols[3].w - 4 });
      doc.text(String(row.soilMoisture), cols[4].x + 2, rowY + 3, { width: cols[4].w - 4 });
      doc.text(row.overallStatus || "-", cols[5].x + 2, rowY + 3, { width: cols[5].w - 4 });
      doc
        .fillColor(LGRAY)
        .text(
          new Date(row.recordedAt).toLocaleString(),
          cols[6].x + 2, rowY + 3,
          { width: cols[6].w - 4 }
        );

      doc.fillColor(BLACK);
      rowY += ROW_H;
    });

    // Table bottom border
    doc.moveTo(40, rowY).lineTo(555, rowY).strokeColor("#cccccc").lineWidth(0.5).stroke();
    rowY += 10;

    // Totals row
    if (rowY > 760) { doc.addPage(); rowY = 40; }
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(BLACK)
      .text("Total Trees: " + totalTrees, 40, rowY)
      .text("Normal: " + statusCounts.Normal, 160, rowY)
      .text("Warning: " + statusCounts.Warning, 260, rowY)
      .text("Critical: " + statusCounts.Critical, 360, rowY);

    rowY += 22;

    // =========================================================================
    // THRESHOLD REFERENCE TABLE
    // =========================================================================
    if (rowY > 700) { doc.addPage(); rowY = 40; }

    doc.moveTo(40, rowY).lineTo(555, rowY).strokeColor("#dddddd").lineWidth(0.6).stroke();
    rowY += 10;

    doc
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .fillColor(BLACK)
      .text("Sensor Threshold Reference", 40, rowY);

    rowY += 14;

    const thCols = [
      { label: "Parameter",     x: 40,  w: 100 },
      { label: "Normal Range",  x: 140, w: 120 },
      { label: "Warning Range", x: 260, w: 140 },
      { label: "Critical Range",x: 400, w: 155 },
    ];

    const TH_HDR = 14;
    const TH_ROW = 12;

    doc.rect(40, rowY, PAGE_W, TH_HDR).fillColor("#eeeeee").fill();
    doc.moveTo(40, rowY + TH_HDR).lineTo(555, rowY + TH_HDR).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLACK);
    thCols.forEach((c) => doc.text(c.label, c.x + 2, rowY + 3, { width: c.w - 4 }));
    rowY += TH_HDR;

    const thresholds = [
      { param: "Temperature",   normal: "25C - 40C",   warning: "20-25C or 40-45C",   critical: "< 20C or > 45C"  },
      { param: "Humidity",      normal: "40% - 65%",   warning: "20-40% or 65-80%",   critical: "< 20% or > 80%"  },
      { param: "Soil Moisture", normal: "50% - 75%",   warning: "40-50% or 75-85%",   critical: "< 40% or > 85%"  },
      { param: "Soil pH",       normal: "4.5 - 6.0",   warning: "3.8-4.5 or 6.0-6.5", critical: "< 3.8 or > 6.5" },
    ];

    thresholds.forEach((t, idx) => {
      if (idx % 2 === 0) {
        doc.rect(40, rowY, PAGE_W, TH_ROW).fillColor("#f9f9f9").fill();
      }
      doc.moveTo(40, rowY + TH_ROW).lineTo(555, rowY + TH_ROW).strokeColor("#eeeeee").lineWidth(0.3).stroke();
      doc.font("Helvetica").fontSize(7.5).fillColor(BLACK);
      doc.text(t.param,    thCols[0].x + 2, rowY + 2, { width: thCols[0].w - 4 });
      doc.text(t.normal,   thCols[1].x + 2, rowY + 2, { width: thCols[1].w - 4 });
      doc.text(t.warning,  thCols[2].x + 2, rowY + 2, { width: thCols[2].w - 4 });
      doc.text(t.critical, thCols[3].x + 2, rowY + 2, { width: thCols[3].w - 4 });
      rowY += TH_ROW;
    });

    rowY += 20;

    // =========================================================================
    // FOOTER
    // =========================================================================
    const footerY = Math.max(rowY, 800);
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(LGRAY)
      .text(
        "2025 Oudra - Decision Support System for Agarwood Plantation. All rights reserved.",
        40, footerY,
        { align: "center", width: PAGE_W }
      );

    doc.end();

  } catch (err) {
    console.error("Sensor Report Error: " + err.message, err.stack);
    if (doc && !doc.ended) doc.end();
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate report", details: err.message });
    }
  }
};

module.exports = { generateSensorReport };