// path: oudra-server/app/controllers/certificateController.js
const PDFDocument = require("pdfkit");
const QRCode      = require("qrcode");
const Tree        = require("../models/TreeModel");
const Investor    = require("../models/Investor");
const Certificate = require("../models/Certificate");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function roundRect(doc, x, y, w, h, r, fillColor) {
  doc.save().roundedRect(x, y, w, h, r).fill(fillColor).restore();
}

function shortHash(hash) {
  if (!hash) return "N/A";
  return `${hash.slice(0, 14)}...${hash.slice(-8)}`;
}

async function generateQRBuffer(url) {
  return await QRCode.toBuffer(url, {
    type:         "png",
    width:        140,
    margin:       1,
    color:        { dark: "#1b4332", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF BUILDER
// ─────────────────────────────────────────────────────────────────────────────

async function buildCertificatePDF(doc, investor, trees, certificate, downloadUrl) {
  const PAGE_W = doc.page.width;
  const MARGIN = 48;
  const GREEN  = "#1b4332";
  const LIGHT  = "#52b788";
  const PALE   = "#f0fdf4";
  const BORDER = "#d1fae5";
  const GREY   = "#6b7280";
  const BLACK  = "#111827";

  const contractAddress = process.env.AGARWOOD_REGISTRY_ADDRESS || "0x331afe80b9d842a838903630a77fc51d148909e8";
  const contractUrl     = `https://amoy.polygonscan.com/address/${contractAddress}`;
  const qrUrl           = contractUrl; // Header QR → contract address on PolygonScan

  // ── QR CODE (generate before streaming) ────────────────────────────────────
  const qrBuffer = await generateQRBuffer(qrUrl);

  // ── HEADER BAND ────────────────────────────────────────────────────────────
  roundRect(doc, 0, 0, PAGE_W, 140, 0, GREEN);

  doc.fontSize(24).fillColor("#ffffff").font("Helvetica-Bold")
     .text("OUDRA PLANTATION", MARGIN, 24, { width: PAGE_W - MARGIN * 2 - 160 });

  doc.fontSize(10).fillColor(LIGHT).font("Helvetica")
     .text("Blockchain-Verified Harvest Certificate", MARGIN, 56);

  doc.fontSize(9).fillColor("#b7e4c7")
     .text(`Certificate No: ${certificate.certificateNumber || certificate.certificateId}`, MARGIN, 76)
     .text(`Issued: ${new Date(certificate.issueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, MARGIN, 90)
     .text(`Network: Polygon Amoy Testnet`, MARGIN, 104);

  // QR code in header (top right)
  doc.image(qrBuffer, PAGE_W - 130, 8, { width: 120, height: 120 });
  doc.fontSize(7).fillColor("#b7e4c7").font("Helvetica")
     .text("Scan to verify on blockchain", PAGE_W - 134, 128, { width: 128, align: "center" });

  // ── VERIFIED BADGE ─────────────────────────────────────────────────────────
  let y = 158;
  roundRect(doc, MARGIN, y, PAGE_W - MARGIN * 2, 32, 8, "#dcfce7");
  doc.fontSize(11).fillColor(GREEN).font("Helvetica-Bold")
     .text("✅  This certificate is immutably recorded on the Polygon blockchain and cannot be altered or deleted.", MARGIN + 14, y + 10, { width: PAGE_W - MARGIN * 2 - 28 });
  y += 46;

  // ── INVESTOR DETAILS ────────────────────────────────────────────────────────
  doc.fontSize(12).fillColor(GREEN).font("Helvetica-Bold").text("INVESTOR DETAILS", MARGIN, y);
  doc.moveTo(MARGIN, y + 17).lineTo(PAGE_W - MARGIN, y + 17).strokeColor(BORDER).lineWidth(1).stroke();
  y += 24;

  const fields = [
    ["Full Name",        investor.name           || "—"],
    ["Investor ID",      investor.investorId     || "—"],
    ["Email Address",    investor.email          || "—"],
    ["Phone Number",     investor.phone          || "—"],
    ["Total Investment", `LKR ${(investor.investment || 0).toLocaleString()}`],
    ["Issue Date",       new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ];

  const COL = (PAGE_W - MARGIN * 2) / 2;
  fields.forEach(([label, value], i) => {
    const cx = MARGIN + (i % 2 === 0 ? 0 : COL);
    const cy = y + Math.floor(i / 2) * 36;
    roundRect(doc, cx, cy, COL - 8, 30, 6, PALE);
    doc.fontSize(7).fillColor(GREY).font("Helvetica").text(label.toUpperCase(), cx + 10, cy + 5);
    doc.fontSize(10).fillColor(BLACK).font("Helvetica-Bold").text(value, cx + 10, cy + 15, { width: COL - 24, ellipsis: true });
  });
  y += Math.ceil(fields.length / 2) * 36 + 20;

  // ── TREE TABLE ──────────────────────────────────────────────────────────────
  if (y > doc.page.height - 160) { doc.addPage(); y = MARGIN; }

  doc.fontSize(12).fillColor(GREEN).font("Helvetica-Bold").text("HARVESTED TREE RECORDS ON BLOCKCHAIN", MARGIN, y);
  doc.moveTo(MARGIN, y + 17).lineTo(PAGE_W - MARGIN, y + 17).strokeColor(BORDER).lineWidth(1).stroke();
  y += 24;

  const COLS  = [70, 105, 150, 60, 55];
  const HEADS = ["Tree ID", "GPS Coordinates", "Blockchain Tx Hash", "Verify QR", "Status"];

  // Header row
  roundRect(doc, MARGIN, y, PAGE_W - MARGIN * 2, 22, 4, GREEN);
  let cx = MARGIN;
  HEADS.forEach((h, i) => {
    doc.fontSize(7).fillColor("#fff").font("Helvetica-Bold").text(h, cx + 4, y + 7, { width: COLS[i] - 6 });
    cx += COLS[i];
  });
  y += 22;

  // Generate per-tree QR buffers before rendering
  const treeQRBuffers = await Promise.all(trees.map(async (tree) => {
    const txHash = tree.blockchainTxHash || null;
    if (!txHash) return null;
    return await generateQRBuffer(`https://amoy.polygonscan.com/tx/${txHash}`);
  }));

  for (let idx = 0; idx < trees.length; idx++) {
    const tree = trees[idx];
    if (y > doc.page.height - 100) { doc.addPage(); y = MARGIN; }
    const rowH   = 52;
    const bg     = idx % 2 === 0 ? "#ffffff" : PALE;
    const txHash = tree.blockchainTxHash || null;
    const gps    = tree.gps ? `${tree.gps.lat?.toFixed(5)}, ${tree.gps.lng?.toFixed(5)}` : "N/A";
    const status = tree.blockchainStatus === "Verified" ? "Verified" : "Pending";

    roundRect(doc, MARGIN, y, PAGE_W - MARGIN * 2, rowH, 0, bg);

    // Tree ID
    doc.fontSize(7).fillColor(BLACK).font("Helvetica-Bold")
       .text(tree.treeId || "—", MARGIN + 4, y + 10, { width: COLS[0] - 6 });

    // GPS
    doc.fontSize(7).fillColor(BLACK).font("Helvetica")
       .text(gps, MARGIN + COLS[0] + 4, y + 10, { width: COLS[1] - 6 });

    // Tx Hash (two lines)
    if (txHash) {
      doc.fontSize(6).fillColor(BLACK).font("Helvetica")
         .text(txHash.slice(0, 20), MARGIN + COLS[0] + COLS[1] + 4, y + 6, { width: COLS[2] - 6 })
         .text(txHash.slice(20, 42), MARGIN + COLS[0] + COLS[1] + 4, y + 16, { width: COLS[2] - 6 })
         .text(txHash.slice(42), MARGIN + COLS[0] + COLS[1] + 4, y + 26, { width: COLS[2] - 6 });
    } else {
      doc.fontSize(7).fillColor(GREY).font("Helvetica")
         .text("N/A", MARGIN + COLS[0] + COLS[1] + 4, y + 10, { width: COLS[2] - 6 });
    }

    // Per-tree QR code
    const qrBuf = treeQRBuffers[idx];
    const qrColX = MARGIN + COLS[0] + COLS[1] + COLS[2];
    if (qrBuf) {
      doc.image(qrBuf, qrColX + 4, y + 2, { width: 48, height: 48 });
    } else {
      doc.fontSize(6).fillColor(GREY).font("Helvetica")
         .text("No tx", qrColX + 4, y + 20, { width: COLS[3] - 6 });
    }

    // Status
    const statusX = MARGIN + COLS[0] + COLS[1] + COLS[2] + COLS[3];
    doc.fontSize(7).fillColor("#15803d").font("Helvetica-Bold")
       .text(status, statusX + 4, y + 10, { width: COLS[4] - 6 });

    doc.moveTo(MARGIN, y + rowH).lineTo(PAGE_W - MARGIN, y + rowH).strokeColor(BORDER).lineWidth(0.4).stroke();
    y += rowH;
  }

  y += 20;

  // ── BLOCKCHAIN SUMMARY ──────────────────────────────────────────────────────
  if (y > doc.page.height - 160) { doc.addPage(); y = MARGIN; }

  roundRect(doc, MARGIN, y, PAGE_W - MARGIN * 2, 88, 8, PALE);
  doc.rect(MARGIN, y, 4, 88).fill(LIGHT);

  doc.fontSize(11).fillColor(GREEN).font("Helvetica-Bold")
     .text("Blockchain Verification Summary", MARGIN + 16, y + 10);
  doc.fontSize(8.5).fillColor(GREY).font("Helvetica")
     .text(`Smart Contract Address:  ${contractAddress}`,                        MARGIN + 16, y + 28)
     .text(`Network:                 Polygon Amoy Testnet (Chain ID: 80002)`,    MARGIN + 16, y + 42)
     .text(`Harvested Trees:         ${trees.length} trees permanently on-chain`, MARGIN + 16, y + 56)
     .text(`Verify at:               ${contractUrl}`,                            MARGIN + 16, y + 70);
  y += 104;

  // ── QR CODE SECTION ─────────────────────────────────────────────────────────
  if (y > doc.page.height - 200) { doc.addPage(); y = MARGIN; }

  roundRect(doc, MARGIN, y, PAGE_W - MARGIN * 2, 170, 8, "#fff");
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 170).stroke(BORDER);

  // QR code centered — links to contract on PolygonScan
  const QR_SIZE = 120;
  const qrX = PAGE_W / 2 - QR_SIZE / 2;
  doc.image(qrBuffer, qrX, y + 12, { width: QR_SIZE, height: QR_SIZE });

  doc.fontSize(11).fillColor(GREEN).font("Helvetica-Bold")
     .text("Scan to Verify Contract on Blockchain", MARGIN, y + 138, { width: PAGE_W - MARGIN * 2, align: "center" });
  doc.fontSize(8).fillColor(GREY).font("Helvetica")
     .text(contractUrl, MARGIN, y + 153, { width: PAGE_W - MARGIN * 2, align: "center" });
  doc.fontSize(7).fillColor(GREY).font("Helvetica")
     .text("Each tree row above also contains an individual QR linking to its specific blockchain transaction", MARGIN, y + 163, { width: PAGE_W - MARGIN * 2, align: "center" });

  y += 186;

  // ── ROI SUMMARY ─────────────────────────────────────────────────────────────
  if (y > doc.page.height - 160) { doc.addPage(); y = MARGIN; }

  const investment  = investor.investment || 0;
  const year5Value  = investment * 1.6;
  const totalGain   = investment * 0.6;
  const fmt = n => `LKR ${Number(n).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;

  doc.fontSize(12).fillColor(GREEN).font("Helvetica-Bold").text("INVESTMENT ROI SUMMARY", MARGIN, y);
  doc.moveTo(MARGIN, y + 17).lineTo(PAGE_W - MARGIN, y + 17).strokeColor(BORDER).lineWidth(1).stroke();
  y += 24;

  const roiCards = [
    { label: "Initial Investment",     value: fmt(investment),        color: BLACK,     bg: PALE       },
    { label: "Projected Year 5 Value", value: fmt(year5Value),        color: "#2d6a4f", bg: "#dcfce7" },
    { label: "Total Projected Return", value: `+${fmt(totalGain)}`,   color: "#059669", bg: "#f0fdf4" },
    { label: "Projected Growth",       value: "+60% over 5 years",    color: "#0891b2", bg: "#f0f9ff" },
  ];

  const CARD_W = (PAGE_W - MARGIN * 2 - 12) / 4;
  roiCards.forEach((card, i) => {
    const cx = MARGIN + i * (CARD_W + 4);
    roundRect(doc, cx, y, CARD_W, 52, 8, card.bg);
    doc.rect(cx, y, CARD_W, 3).fill(card.color);
    doc.fontSize(7).fillColor(GREY).font("Helvetica")
       .text(card.label.toUpperCase(), cx + 8, y + 10, { width: CARD_W - 16 });
    doc.fontSize(11).fillColor(card.color).font("Helvetica-Bold")
       .text(card.value, cx + 8, y + 24, { width: CARD_W - 16, ellipsis: true });
  });
  y += 64;

  doc.fontSize(7.5).fillColor(GREY).font("Helvetica")
     .text("* ROI projections are estimates based on historical agarwood market data. Actual returns may vary.", MARGIN, y, { width: PAGE_W - MARGIN * 2 });
  y += 20;

  // ── VERIFICATION STATEMENT ──────────────────────────────────────────────────
  if (y > doc.page.height - 100) { doc.addPage(); y = MARGIN; }

  roundRect(doc, MARGIN, y, PAGE_W - MARGIN * 2, 60, 8, "#fffbeb");
  doc.rect(MARGIN, y, 4, 60).fill("#f59e0b");
  doc.fontSize(8.5).fillColor("#92400e").font("Helvetica")
     .text(
       "This certificate confirms that the above harvested tree records have been immutably stored on the Polygon Amoy blockchain. " +
       "Each blockchain transaction hash serves as a permanent, tamper-proof proof of harvest enrollment. " +
       "Scan the QR code or visit amoy.polygonscan.com to independently verify these records without trusting any central authority.",
       MARGIN + 14, y + 10, { width: PAGE_W - MARGIN * 2 - 24, lineGap: 3 }
     );
  y += 76;

  // ── SIGNATURES ──────────────────────────────────────────────────────────────
  if (y > doc.page.height - 100) { doc.addPage(); y = MARGIN; }

  const SIG_W = (PAGE_W - MARGIN * 2 - 24) / 2;
  [
    { label: "Authorized Signatory",    name: "Oudra Plantation Pvt Ltd" },
    { label: "Investor Acknowledgement", name: investor.name || "Investor" },
  ].forEach((sig, i) => {
    const sx = MARGIN + i * (SIG_W + 24);
    doc.moveTo(sx, y + 32).lineTo(sx + SIG_W, y + 32).strokeColor(GREEN).lineWidth(1).stroke();
    doc.fontSize(8).fillColor(GREY).font("Helvetica").text(sig.label, sx, y + 38, { width: SIG_W, align: "center" });
    doc.fontSize(10).fillColor(GREEN).font("Helvetica-Bold").text(sig.name, sx, y + 52, { width: SIG_W, align: "center" });
  });

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  roundRect(doc, 0, doc.page.height - 36, PAGE_W, 36, 0, GREEN);
  doc.fontSize(7.5).fillColor("#b7e4c7").font("Helvetica")
     .text(
       `Oudra Plantation Pvt Ltd  •  Blockchain-Secured Harvest Certificate  •  ${certificate.certificateId}  •  Generated ${new Date().toISOString().slice(0, 10)}`,
       MARGIN, doc.page.height - 22, { width: PAGE_W - MARGIN * 2, align: "center" }
     );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

exports.downloadHarvestCertificate = async (req, res) => {
  try {
    const { investorId } = req.params;

    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, message: "Investor not found" });
    }

    const trees = await Tree.find({
      investor:         investor._id,
      lifecycleStatus:  "Harvested",
      blockchainStatus: "Verified",
    }).sort({ treeId: 1 });

    if (trees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No harvested and blockchain-verified trees found. Trees must be harvested and synced to blockchain before a certificate can be issued.",
      });
    }

    // Find or create certificate record
    let certificate = await Certificate.findOne({
      investor: investor._id,
      type:     "HARVEST",
      status:   "ACTIVE",
    });

    if (!certificate) {
      const certNumber = await Certificate.generateCertificateNumber();
      certificate = new Certificate({
        certificateId:     `HAR-${investor.investorId}-${Date.now().toString().slice(-6)}`,
        certificateNumber: certNumber,
        investor:          investor._id,
        type:              "HARVEST",
        status:            "ACTIVE",
        issueDate:         new Date(),
        issuedBy:          "Oudra Plantation System",
        data: {
          investorDetails: {
            name:       investor.name,
            email:      investor.email,
            phone:      investor.phone,
            investment: investor.investment,
          },
        },
        qrCodeUrl: `https://amoy.polygonscan.com/address/${process.env.AGARWOOD_REGISTRY_ADDRESS || ""}`,
      });
      await certificate.save();

      await Investor.findByIdAndUpdate(investor._id, {
        $addToSet: { certificates: { certificate: certificate._id } },
      });
    }

    // Stream PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Harvest_Certificate_${investor.investorId}.pdf"`);

    const doc = new PDFDocument({
      size: "A4", margin: 48,
      info: {
        Title:   `Harvest Certificate — ${investor.name}`,
        Author:  "Oudra Plantation Pvt Ltd",
        Subject: "Blockchain-Verified Harvest Certificate",
      },
    });

    const dlUrl = `${process.env.BASE_URL || "http://localhost:5000"}/api/certificates/harvest/${investor._id}`;
    doc.pipe(res);
    await buildCertificatePDF(doc, investor, trees, certificate, dlUrl);
    doc.end();

  } catch (err) {
    console.error("❌ Certificate generation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

exports.getInvestorCertificates = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.investorId).populate({
      path: "certificates.certificate",
      populate: { path: "tree", select: "treeId block lifecycleStatus" },
    });
    if (!investor) return res.status(404).json({ success: false, message: "Investor not found" });
    res.json({ success: true, data: investor.certificates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getAllCertificates = async (req, res) => {
  try {
    const certificates = await Certificate.find({ status: { $ne: "REVOKED" } })
      .populate("investor", "name email investorId")
      .populate("tree",     "treeId lifecycleStatus blockchainStatus")
      .sort({ issueDate: -1 });
    res.json({ success: true, count: certificates.length, data: certificates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getHarvestableTreesByInvestor = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.investorId);
    if (!investor) return res.status(404).json({ success: false, message: "Investor not found" });
    const trees = await Tree.find({
      investor:         investor._id,
      lifecycleStatus:  "Harvested",
      blockchainStatus: "Verified",
    }).sort({ treeId: 1 });
    res.json({ success: true, count: trees.length, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getCertificateStats = async (req, res) => {
  try {
    const stats = await Certificate.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = exports;