import axios from "axios";
import PDFDocument from "pdfkit";
import { Types } from "mongoose";
import { uploadFile } from "../common/newCloudinary";
import { getKhabiteqEmailLogoUrl } from "../common/constants/emailBranding";
import { ITransactionRegistrationDoc } from "../models/transactionRegistration";
import {
  getLasreraCertificateConfig,
  ILasreraCertificateConfig,
  readBundledLasreraLogo,
} from "./lasreraSettings.service";
import { normalizeImageForPdf } from "../utils/imageForPdf";
import {
  CERTIFICATE_DISCLAIMER,
  CERTIFICATE_SUBTITLE,
  CERTIFICATE_TITLE,
  certificateVerifyUrl,
  toAuthorizedCertificateView,
} from "./transactionCertificateRecord.service";
import { applyCertificateSnapshot } from "./transactionJourney.service";
import { generateUniqueTransactionReference } from "./transactionReference.service";
import { logCertificateActivity } from "./transactionCertificateAudit.service";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  rental_agreement: "Rental Agreement",
  outright_sale: "Outright Sale",
  off_plan_purchase: "Off-Plan Purchase",
  joint_venture: "Joint Venture",
};

export const SAMPLE_CERTIFICATE_BUYER_NAME = "Adebayo Okonkwo";

export interface CertificateDocumentInput {
  buyerName: string;
  transactionType: string;
  propertyAddress: string;
  transactionValue: number;
  issuedAt: Date;
  certificateNumber: string;
  verifyUrl?: string;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url?.trim()) return null;
  try {
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    return Buffer.from(response.data);
  } catch {
    return null;
  }
}

async function resolveRemoteImage(url?: string): Promise<Buffer | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    const adminBase = (process.env.ADMIN_CLIENT_LINK || "").replace(/\/$/, "");
    if (adminBase) {
      const remote = await fetchImageBuffer(`${adminBase}${trimmed}`);
      if (remote) return remote;
    }
    return null;
  }

  return fetchImageBuffer(trimmed);
}

async function resolveLogoBuffer(logoUrl?: string): Promise<Buffer | null> {
  const remote = await resolveRemoteImage(logoUrl);
  const raw = remote || readBundledLasreraLogo();
  return normalizeImageForPdf(raw);
}

async function resolvePdfImage(url?: string): Promise<Buffer | null> {
  return normalizeImageForPdf(await resolveRemoteImage(url));
}

function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `NGN ${formatted}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function propertyAddress(reg: ITransactionRegistrationDoc): string {
  const ident = reg.propertyIdentification as { exactAddress?: string } | undefined;
  return ident?.exactAddress?.trim() || "As recorded in the registration dossier";
}

export function generateCertificateNumber(registrationId: Types.ObjectId | string): string {
  const year = new Date().getFullYear();
  const suffix = String(registrationId).slice(-8).toUpperCase();
  return `KHT-TR-${suffix}`;
}

export function buildSampleCertificateInput(): CertificateDocumentInput {
  return {
    buyerName: SAMPLE_CERTIFICATE_BUYER_NAME,
    transactionType: "rental_agreement",
    propertyAddress: "14 Admiralty Way, Lekki Phase 1, Lagos",
    transactionValue: 4_500_000,
    issuedAt: new Date(),
    certificateNumber: `KHT-TR-SAMPLE01`,
    verifyUrl: certificateVerifyUrl("KHT-TR-000000"),
  };
}

function inputFromRegistration(
  reg: ITransactionRegistrationDoc,
  certificateNumber: string
): CertificateDocumentInput {
  return {
    buyerName: reg.buyer?.fullName?.trim() || "Registered Buyer",
    transactionType: reg.transactionType,
    propertyAddress: propertyAddress(reg),
    transactionValue: reg.transactionValue,
    issuedAt: reg.certificateIssuedAt || new Date(),
    certificateNumber,
  };
}

function drawDigitalTrailQr(
  doc: InstanceType<typeof PDFDocument>,
  qrBuffer: Buffer,
  pageWidth: number
) {
  const qrSize = 62;
  const qrX = pageWidth - 116;
  const qrY = 56;
  doc.save();
  doc.lineWidth(0.7).strokeColor("#0B5D3B").roundedRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 18, 3).stroke();
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
  doc
    .font("Helvetica-Bold")
    .fontSize(5.5)
    .fillColor("#0B5D3B")
    .text("SCAN FOR DIGITAL TRAIL", qrX - 8, qrY + qrSize + 2, {
      width: qrSize + 16,
      align: "center",
      lineBreak: false,
    });
  doc.restore();
}

async function buildCertificatePdf(
  input: CertificateDocumentInput,
  config: ILasreraCertificateConfig
): Promise<Buffer> {
  const logoBuffer = await resolveLogoBuffer(config.logoUrl);
  const signatureBuffer = await resolvePdfImage(config.signatureUrl);
  const stampBuffer = await resolvePdfImage(config.stampUrl);
  const qrBuffer = input.verifyUrl ? await fetchQrBuffer(input.verifyUrl) : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 100;

    doc
      .lineWidth(2)
      .strokeColor("#0B5D3B")
      .rect(35, 35, pageWidth - 70, pageHeight - 70)
      .stroke();

    doc
      .lineWidth(0.5)
      .strokeColor("#C9A227")
      .rect(42, 42, pageWidth - 84, pageHeight - 84)
      .stroke();

    if (qrBuffer) {
      drawDigitalTrailQr(doc, qrBuffer, pageWidth);
    }

    if (logoBuffer) {
      doc.image(logoBuffer, pageWidth / 2 - 70, 52, { width: 140 });
      doc.y = 148;
    } else {
      doc.y = 70;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#0B5D3B")
      .text("LAGOS STATE REAL ESTATE REGULATORY AUTHORITY", 50, doc.y, {
        width: contentWidth,
        align: "center",
      });

    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#444444")
      .text("Block 21, 1st Floor, Room 109 & 119, The Secretariat, Alausa, Ikeja, Lagos", {
        width: contentWidth,
        align: "center",
      });

    doc.moveDown(1.2);
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#0B5D3B")
      .text("TRANSACTION REGISTRATION CERTIFICATE", {
        width: contentWidth,
        align: "center",
      });

    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666666")
      .text(`Certificate No: ${input.certificateNumber}`, {
        width: contentWidth,
        align: "center",
      });

    doc.moveDown(1.5);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#222222")
      .text(
        "This is to certify that the following transaction has been duly registered with LASRERA through the KHABI-TEQ compliance platform:",
        { width: contentWidth, align: "center" }
      );

    doc.moveDown(1.2);
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#0B5D3B")
      .text(input.buyerName, { width: contentWidth, align: "center" });

    doc.moveDown(0.3);
    doc
      .font("Helvetica-Oblique")
      .fontSize(11)
      .fillColor("#555555")
      .text("(Registered Buyer / Transacting Party)", { width: contentWidth, align: "center" });

    doc.moveDown(1.5);

    const details: [string, string][] = [
      [
        "Transaction Type",
        TRANSACTION_TYPE_LABELS[input.transactionType] || input.transactionType,
      ],
      ["Property Address", input.propertyAddress],
      ["Transaction Value", formatCurrency(input.transactionValue)],
      ["Registration Date", formatDate(input.issuedAt)],
    ];

    const labelX = 80;
    const valueX = 240;
    for (const [label, value] of details) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333").text(`${label}:`, labelX, doc.y, {
        continued: false,
        width: 150,
      });
      const y = doc.y - 12;
      doc.font("Helvetica").fontSize(10).fillColor("#222222").text(value, valueX, y, {
        width: contentWidth - (valueX - 50),
      });
      doc.moveDown(0.6);
    }

    doc.moveDown(1);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#444444")
      .text(
        "This certificate confirms that the transaction details above have been reviewed and approved by LASRERA. It may be presented as evidence of compliance registration for due diligence purposes.",
        60,
        doc.y,
        { width: contentWidth - 20, align: "justify" }
      );

    const signatureY = pageHeight - 170;

    if (signatureBuffer) {
      doc.image(signatureBuffer, 80, signatureY - 45, { width: 120, height: 40, fit: [120, 40] });
    } else {
      doc
        .moveTo(80, signatureY)
        .lineTo(220, signatureY)
        .strokeColor("#333333")
        .lineWidth(0.8)
        .stroke();
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#222222")
      .text(config.signatoryName, 80, signatureY + 8);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#555555")
      .text(config.signatoryTitle, 80, signatureY + 22, { width: 220 });

    if (stampBuffer) {
      doc.image(stampBuffer, pageWidth - 175, signatureY - 70, {
        width: 110,
        height: 110,
        fit: [110, 110],
      });
    }

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#888888")
      .text(`Issued via KHABI-TEQ · ${formatDate(input.issuedAt)}`, 50, pageHeight - 55, {
        width: contentWidth,
        align: "center",
      });

    doc.end();
  });
}

export async function buildCertificatePreviewPdf(
  _config: ILasreraCertificateConfig
): Promise<Buffer> {
  const now = new Date();
  const sample = {
    _id: "000000000000000000000001",
    transactionType: "rental_agreement",
    buyer: { fullName: SAMPLE_CERTIFICATE_BUYER_NAME, email: "", phoneNumber: "" },
    transactionValue: 4_500_000,
    processingFee: 0,
    status: "certificate_issued",
    propertyIdentification: { type: "residential", exactAddress: "14 Admiralty Way, Lekki Phase 1, Lagos" },
    transactionReference: "KHT-TR-SAMPLE01",
    propertyCode: "KH-ABC-12345",
    propertyTypeLabel: "Residential",
    propertyLocationLabel: "Lekki, Eti-Osa, Lagos",
    certificateStatus: "ACTIVE",
    certificateVersion: 1,
    createdAt: now,
    certificateIssuedAt: now,
    updatedAt: now,
    journeyEvents: [],
    participatingProfessionals: [],
    parties: [],
    dueDiligence: [],
  } as unknown as ITransactionRegistrationDoc;
  return buildReferenceLayoutCertificatePdf(sample);
}

export async function ensureTransactionCertificateIdentity(
  reg: ITransactionRegistrationDoc
): Promise<ITransactionRegistrationDoc> {
  if (!reg.transactionReference) {
    reg.transactionReference = await generateUniqueTransactionReference();
  }
  await applyCertificateSnapshot(reg);
  return reg;
}

async function fetchQrBuffer(url: string): Promise<Buffer | null> {
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    const response = await axios.get(qrUrl, { responseType: "arraybuffer", timeout: 12000 });
    return Buffer.from(response.data);
  } catch {
    return null;
  }
}

async function buildKhabiteqCertificatePdf(reg: ITransactionRegistrationDoc): Promise<Buffer> {
  const view = toAuthorizedCertificateView(reg);
  const logoBuffer = await resolvePdfImage(getKhabiteqEmailLogoUrl());
  const qrBuffer = view.verifyUrl ? await fetchQrBuffer(view.verifyUrl) : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - 84;

    doc.lineWidth(2).strokeColor("#09391C").rect(22, 22, pageWidth - 44, pageHeight - 44).stroke();
    doc.lineWidth(0.6).strokeColor("#C9A227").rect(28, 28, pageWidth - 56, pageHeight - 56).stroke();

    if (logoBuffer) {
      doc.image(logoBuffer, pageWidth / 2 - 70, 40, { width: 140 });
      doc.y = 108;
    } else {
      doc.y = 48;
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#09391C").text("KHABITEQ", 42, doc.y, {
        width: contentWidth,
        align: "center",
      });
    }

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#09391C").text(CERTIFICATE_TITLE, 42, doc.y + 8, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(9).fillColor("#6B7280").text(CERTIFICATE_SUBTITLE, {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#09391C").text(
      `TRANSACTION REFERENCE  ${view.transactionReference || "PENDING"}`,
      { width: contentWidth, align: "center" }
    );
    if (view.propertyCode) {
      doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`PROPERTY CODE  ${view.propertyCode}`, {
        width: contentWidth,
        align: "center",
      });
    }

    const qrSize = 86;
    const qrX = pageWidth - 42 - qrSize;
    const qrY = doc.y + 6;
    doc
      .lineWidth(0.8)
      .strokeColor("#C9A227")
      .roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 36, 4)
      .stroke();
    if (qrBuffer) {
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor("#09391C")
      .text("DIGITAL TRAIL", qrX - 8, qrY + qrSize + 4, {
        width: qrSize + 16,
        align: "center",
      });
    doc.font("Helvetica").fontSize(8).fillColor("#374151").text(
      "Scan the code to open this property's journey, from the preference search through inspection and due diligence to transaction registration.",
      42,
      qrY + 8,
      { width: qrX - 58 }
    );
    doc.y = qrY + qrSize + 40;

    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#09391C").text("TRANSACTION SUMMARY");
    doc.moveDown(0.25);

    const summary: [string, string][] = [
      ["Transaction Reference", view.transactionReference || "—"],
      ["Property Code", view.propertyCode || "—"],
      ["Property Type", view.propertyType || "—"],
      ["Property Location", view.propertyLocation || "—"],
      ["Transaction Type", view.transactionType],
      ["Transaction Status", view.transactionStatus],
      ["Certificate Status", view.certificateStatus || "—"],
      ["Version", view.certificateVersion ? `${view.certificateVersion}.0` : "1.0"],
      ["Registration Date", view.registrationDate || "—"],
    ];

    for (const [label, value] of summary) {
      const y = doc.y;
      doc.font("Helvetica").fontSize(8).fillColor("#6B7280").text(label.toUpperCase(), 42, y, { width: 160 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827").text(value, 210, y, { width: contentWidth - 168 });
      doc.moveDown(0.28);
    }

    if (view.journey.length) {
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#09391C").text("TRANSACTION JOURNEY");
      doc.moveDown(0.2);
      for (const row of view.journey.slice(0, 10)) {
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#09391C").text(row.step, 42, y, { width: 24 });
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(row.title.toUpperCase(), 70, y, {
          width: 300,
        });
        doc.font("Helvetica").fontSize(8).fillColor("#6B7280").text(row.date, 380, y, { width: 140, align: "right" });
        doc.moveDown(0.28);
      }
    }

    if (view.participatingProfessionals.length) {
      doc.moveDown(0.35);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#09391C").text("PARTICIPATING PROFESSIONALS");
      doc.moveDown(0.2);
      for (const pro of view.participatingProfessionals.slice(0, 4)) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(pro.name);
        doc.font("Helvetica").fontSize(8).fillColor("#4B5563").text(
          [pro.category, pro.licenceNumber, pro.verificationStatus].filter(Boolean).join("  ·  ")
        );
        doc.moveDown(0.15);
      }
    }

    doc
      .font("Helvetica")
      .fontSize(6.5)
      .fillColor("#6B7280")
      .text(CERTIFICATE_DISCLAIMER, 42, pageHeight - 78, {
        width: contentWidth,
        align: "justify",
      });

    doc.end();
  });
}

async function buildReferenceLayoutCertificatePdf(reg: ITransactionRegistrationDoc): Promise<Buffer> {
  const view = toAuthorizedCertificateView(reg);
  const logo = await resolvePdfImage(getKhabiteqEmailLogoUrl());
  const qr = view.verifyUrl ? await fetchQrBuffer(view.verifyUrl) : null;
  const propertyImage = view.propertyDetails?.imageUrl ? await resolvePdfImage(view.propertyDetails.imageUrl) : null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const x = 26;
    const inner = W - 52;
    const gap = 9;
    const leftW = 235;
    const rightX = x + leftW + gap;
    const rightW = inner - leftW - gap;
    const ink = "#14261C";
    const green = "#0B5D3B";
    const muted = "#66736B";
    const panel = (px: number, py: number, pw: number, ph: number, heading: string, fill = "#FFFFFF") => {
      doc.roundedRect(px, py, pw, ph, 8).fillAndStroke(fill, "#E3EBE6");
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(ink).text(heading.toUpperCase(), px + 9, py + 8, { width: pw - 18 });
    };

    doc.lineWidth(1.5).strokeColor("#238357").roundedRect(12, 12, W - 24, H - 24, 12).stroke();
    doc.lineWidth(0.6).strokeColor("#D4E8DC").roundedRect(17, 17, W - 34, H - 34, 9).stroke();
    if (logo) doc.image(logo, x, 27, { width: 130, height: 38, fit: [130, 38] });
    else doc.font("Helvetica-Bold").fontSize(17).fillColor(green).text("KHABITEQ", x, 34);
    doc.font("Helvetica-Bold").fontSize(6).fillColor(muted).text("CERTIFICATE STATUS", W - 160, 34, { width: 90 });
    doc.roundedRect(W - 77, 27, 62, 20, 10).fill("#D7F5E0");
    doc.font("Helvetica-Bold").fontSize(7).fillColor(green).text(view.certificateStatus || "ACTIVE", W - 74, 34, { width: 56, align: "center" });

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#073B25").text(CERTIFICATE_TITLE, x, 75, { width: 360, lineGap: 1 });
    doc.font("Helvetica").fontSize(7).fillColor(muted).text(CERTIFICATE_SUBTITLE, x, 120, { characterSpacing: 2.1 });
    doc.roundedRect(W - 222, 76, 196, 53, 8).fill("#EAF6EF");
    doc.font("Helvetica").fontSize(6).fillColor(muted).text("TRANSACTION REFERENCE", W - 210, 84, { characterSpacing: 1 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(ink).text(view.transactionReference || "PENDING", W - 210, 98, { width: 172 });
    doc.font("Helvetica").fontSize(7).fillColor(muted).text(`Property Code: ${view.propertyCode || "—"}`, W - 210, 116, { width: 172 });

    const summaryY = 139;
    doc.roundedRect(x, summaryY, inner, 37, 7).lineWidth(0.5).strokeColor("#E2EAE5").stroke();
    const summaries: [string, string][] = [["Property Type", view.propertyType || "—"], ["Transaction Type", view.transactionType], ["Property Location", view.propertyLocation || "—"], ["Registration Date", view.registrationDate || "—"]];
    summaries.forEach(([label, value], i) => {
      const cw = inner / 4;
      const cx = x + i * cw + 8;
      if (i) doc.moveTo(x + i * cw, summaryY + 5).lineTo(x + i * cw, summaryY + 32).lineWidth(0.5).strokeColor("#E2EAE5").stroke();
      doc.font("Helvetica").fontSize(5.6).fillColor(muted).text(label.toUpperCase(), cx, summaryY + 7, { width: cw - 14 });
      doc.font("Helvetica-Bold").fontSize(7).fillColor(ink).text(value || "—", cx, summaryY + 20, { width: cw - 14, ellipsis: true });
    });

    const top = 186;
    const journey = (view.journey || []).slice(0, 13);
    panel(x, top, leftW, 33 + journey.length * 34, "Transaction Journey", "#EFF9F2");
    journey.forEach((row, i) => {
      const yy = top + 28 + i * 34;
      if (i < journey.length - 1) doc.moveTo(x + 10, yy + 14).lineTo(x + 10, yy + 37).lineWidth(1).strokeColor("#80C795").stroke();
      doc.circle(x + 10, yy + 7, 6.5).fill(green);
      doc.font("Helvetica-Bold").fontSize(5.8).fillColor("#FFFFFF").text(String(i + 1), x + 8, yy + 4, { width: 4, align: "center" });
      doc.font("Helvetica-Bold").fontSize(6).fillColor(ink).text(row.title.toUpperCase(), x + 23, yy, { width: 132, ellipsis: true });
      doc.roundedRect(x + leftW - 58, yy, 49, 12, 6).fill("#D6F5DF");
      doc.font("Helvetica-Bold").fontSize(5).fillColor(green).text(row.notApplicable ? "N/A" : "COMPLETED", x + leftW - 56, yy + 3, { width: 45, align: "center" });
      doc.font("Helvetica").fontSize(5.4).fillColor(muted).text(row.notApplicable ? "Not applicable" : row.date || "—", x + 23, yy + 13, { width: leftW - 38, ellipsis: true });
    });

    let sy = top;
    panel(rightX, sy, rightW, 129, "Property Details");
    if (propertyImage) doc.image(propertyImage, rightX + 9, sy + 25, { width: 96, height: 94, fit: [96, 94] });
    else doc.roundedRect(rightX + 9, sy + 25, 96, 94, 5).fill("#EEF4F0");
    const pd = view.propertyDetails;
    const propertyRows: [string, string][] = [["Property Code", view.propertyCode || "—"], ["Property Type", view.propertyType || "—"], ["Listing Type", pd?.listingType || "—"], ["Location", pd?.address || view.propertyLocation || "—"], ["Bedrooms", String(pd?.bedrooms ?? "—")], ["Bathrooms", String(pd?.bathrooms ?? "—")], ["Parking", String(pd?.parking ?? "—")], ["Land Size", pd?.landSize || "—"], ["Listed on Khabiteq", pd?.listedAt || "—"]];
    propertyRows.forEach(([label, value], i) => {
      const yy = sy + 27 + i * 10;
      doc.font("Helvetica").fontSize(5.2).fillColor(muted).text(label, rightX + 113, yy, { width: 68 });
      doc.font("Helvetica-Bold").fontSize(5.4).fillColor(ink).text(value, rightX + 181, yy, { width: rightW - 188, ellipsis: true });
    });
    sy += 136;

    panel(rightX, sy, rightW, 56, "Transaction Parties");
    (view.parties || []).slice(0, 2).forEach((party, i) => {
      const px = rightX + 10 + i * (rightW / 2);
      doc.font("Helvetica").fontSize(5.2).fillColor(muted).text(party.role.toUpperCase(), px, sy + 27, { width: rightW / 2 - 16 });
      doc.font("Helvetica-Bold").fontSize(6.6).fillColor(ink).text(party.displayName, px, sy + 37, { width: rightW / 2 - 16, ellipsis: true });
    });
    sy += 63;

    const pros = view.participatingProfessionals || [];
    panel(rightX, sy, rightW, Math.max(50, 27 + pros.slice(0, 2).length * 20), "Professionals Engaged");
    pros.slice(0, 2).forEach((pro, i) => {
      const yy = sy + 26 + i * 20;
      doc.font("Helvetica-Bold").fontSize(5.8).fillColor(ink).text(`${pro.category}  ${pro.name}`, rightX + 11, yy, { width: rightW - 70, ellipsis: true });
      doc.font("Helvetica").fontSize(5.2).fillColor(muted).text(pro.licenceNumber ? `Licence No: ${pro.licenceNumber}` : pro.verificationStatus || "", rightX + 11, yy + 9, { width: rightW - 24, ellipsis: true });
    });
    sy += Math.max(57, 34 + pros.slice(0, 2).length * 20);

    const docs = view.documentTrail || [];
    panel(rightX, sy, rightW, 28 + Math.max(1, docs.length) * 14, "Document Trail");
    docs.slice(0, 4).forEach((item, i) => {
      const yy = sy + 24 + i * 14;
      doc.font("Helvetica").fontSize(5.7).fillColor(ink).text(item.type, rightX + 9, yy, { width: rightW - 70, ellipsis: true });
      doc.font("Helvetica").fontSize(5.2).fillColor(muted).text(view.registrationDate || "—", rightX + rightW - 59, yy, { width: 32 });
      doc.font("Helvetica-Bold").fontSize(4.9).fillColor(green).text(item.status, rightX + rightW - 25, yy, { width: 20, ellipsis: true });
    });
    sy += 35 + Math.max(1, docs.length) * 14;

    const payments = view.paymentRecord || [];
    panel(rightX, sy, rightW, 28 + Math.max(1, payments.length) * 16, "Payment Record");
    payments.slice(0, 3).forEach((item, i) => {
      const yy = sy + 24 + i * 16;
      doc.font("Helvetica").fontSize(5.3).fillColor(ink).text(item.description, rightX + 9, yy, { width: 95, ellipsis: true });
      doc.font("Helvetica").fontSize(5).fillColor(muted).text(item.reference || "—", rightX + 106, yy, { width: 42, ellipsis: true });
      doc.font("Helvetica").fontSize(5).fillColor(muted).text(item.date || "—", rightX + 150, yy, { width: 35 });
      doc.font("Helvetica").fontSize(5).fillColor(ink).text(item.amount != null ? `NGN ${item.amount.toLocaleString("en-NG")}` : "—", rightX + 188, yy, { width: 48, ellipsis: true });
      doc.font("Helvetica-Bold").fontSize(5).fillColor(green).text(item.status, rightX + 238, yy, { width: rightW - 247, ellipsis: true });
    });

    const foot = H - 96;
    doc.moveTo(x, foot).lineTo(W - x, foot).lineWidth(0.5).strokeColor("#E1E9E4").stroke();
    if (qr) doc.image(qr, x, foot + 6, { width: 58, height: 58 });
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(ink).text("VERIFY THIS CERTIFICATE", x + 66, foot + 8);
    doc.font("Helvetica").fontSize(5.6).fillColor(muted).text("Scan the QR code to view this live record on Khabiteq.", x + 66, foot + 19, { width: 210 });
    doc.font("Helvetica").fontSize(5.2).fillColor("#1D4ED8").text(view.verifyUrl || "", x + 66, foot + 29, { width: 236, ellipsis: true });
    doc.font("Helvetica").fontSize(5.4).fillColor(muted).text(`Issued ${view.issuedAt || "—"}  ·  Last updated ${view.lastUpdated || "—"}  ·  Version ${view.certificateVersion || 1}.0`, x + 66, foot + 41, { width: 250 });
    doc.font("Helvetica").fontSize(4.8).fillColor(muted).text(CERTIFICATE_DISCLAIMER, x, H - 28, { width: inner, height: 17, align: "justify", ellipsis: true });
    doc.end();
  });
}

export async function generateAndStoreRegistrationCertificate(
  reg: ITransactionRegistrationDoc,
  issuedByAdminId?: Types.ObjectId | string
): Promise<{ certificateNumber: string; certificateUrl: string; transactionReference: string }> {
  await ensureTransactionCertificateIdentity(reg);

  const previousUrl = reg.certificateUrl;
  const previousVersion = reg.certificateVersion || 0;
  if (previousUrl && previousVersion > 0) {
    reg.certificateVersions = [
      ...(reg.certificateVersions || []),
      {
        version: previousVersion,
        snapshotAt: reg.certificateIssuedAt || new Date(),
        certificateUrl: previousUrl,
        reason: "Reissued",
        actorType: issuedByAdminId ? "Admin" : "System",
        actorId: issuedByAdminId ? new Types.ObjectId(String(issuedByAdminId)) : undefined,
      },
    ];
  }

  const nextVersion = previousVersion > 0 ? previousVersion + 1 : 1;
  const certificateNumber = reg.transactionReference || generateCertificateNumber(String(reg._id));
  const pdfBuffer = await buildReferenceLayoutCertificatePdf(reg);
  const base64 = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
  const filename = `khabiteq-certificate-${reg.transactionReference || String(reg._id).slice(-8)}`;

  const upload = await uploadFile(base64, filename, "khabiteq/certificates", "raw", {
    format: "pdf",
  });

  reg.certificateNumber = certificateNumber;
  reg.certificateUrl = upload.secure_url;
  reg.certificateIssuedAt = new Date();
  reg.certificateLastUpdatedAt = new Date();
  reg.certificateVersion = nextVersion;
  reg.certificateStatus = nextVersion > 1 ? "UPDATED" : "ACTIVE";
  if (issuedByAdminId) {
    reg.certificateIssuedBy = new Types.ObjectId(String(issuedByAdminId));
  }
  reg.status = "certificate_issued";
  await reg.save();

  await logCertificateActivity({
    registrationId: String(reg._id),
    transactionReference: reg.transactionReference,
    actorType: issuedByAdminId ? "Admin" : "System",
    actorId: issuedByAdminId,
    action: nextVersion > 1 ? "CERTIFICATE_REISSUED" : "CERTIFICATE_ISSUED",
    nextValue: {
      version: nextVersion,
      certificateUrl: upload.secure_url,
    },
  });

  return {
    certificateNumber,
    certificateUrl: upload.secure_url,
    transactionReference: String(reg.transactionReference),
  };
}
