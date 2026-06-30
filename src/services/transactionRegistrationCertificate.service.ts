import axios from "axios";
import PDFDocument from "pdfkit";
import { Types } from "mongoose";
import { uploadFile } from "../common/newCloudinary";
import { ITransactionRegistrationDoc } from "../models/transactionRegistration";
import {
  getLasreraCertificateConfig,
  ILasreraCertificateConfig,
} from "./lasreraSettings.service";

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  rental_agreement: "Rental Agreement",
  outright_sale: "Outright Sale",
  off_plan_purchase: "Off-Plan Purchase",
  joint_venture: "Joint Venture",
};

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url?.trim()) return null;
  try {
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    return Buffer.from(response.data);
  } catch {
    return null;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
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
  return `LASRERA/TRC/${year}/${suffix}`;
}

async function buildCertificatePdf(
  reg: ITransactionRegistrationDoc,
  certificateNumber: string,
  config: ILasreraCertificateConfig
): Promise<Buffer> {
  const logoBuffer = await fetchImageBuffer(config.logoUrl);
  const signatureBuffer = config.signatureUrl ? await fetchImageBuffer(config.signatureUrl) : null;
  const issuedAt = reg.certificateIssuedAt || new Date();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100;

    // Outer border
    doc
      .lineWidth(2)
      .strokeColor("#0B5D3B")
      .rect(35, 35, pageWidth - 70, doc.page.height - 70)
      .stroke();

    doc
      .lineWidth(0.5)
      .strokeColor("#C9A227")
      .rect(42, 42, pageWidth - 84, doc.page.height - 84)
      .stroke();

    // Logo
    if (logoBuffer) {
      doc.image(logoBuffer, pageWidth / 2 - 60, 58, { width: 120 });
      doc.y = 145;
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
      .text(`Certificate No: ${certificateNumber}`, { width: contentWidth, align: "center" });

    doc.moveDown(1.5);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#222222")
      .text("This is to certify that the following transaction has been duly registered with LASRERA through the KHABI-TEQ compliance platform:", {
        width: contentWidth,
        align: "center",
      });

    doc.moveDown(1.2);
    const buyerName = reg.buyer?.fullName?.trim() || "Registered Buyer";
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#0B5D3B")
      .text(buyerName, { width: contentWidth, align: "center" });

    doc.moveDown(0.3);
    doc
      .font("Helvetica-Oblique")
      .fontSize(11)
      .fillColor("#555555")
      .text("(Registered Buyer / Transacting Party)", { width: contentWidth, align: "center" });

    doc.moveDown(1.5);

    const details: [string, string][] = [
      ["Transaction Type", TRANSACTION_TYPE_LABELS[reg.transactionType] || reg.transactionType],
      ["Property Address", propertyAddress(reg)],
      ["Transaction Value", formatCurrency(reg.transactionValue)],
      ["Registration Date", formatDate(issuedAt)],
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

    // Signature block
    const signatureY = doc.page.height - 170;
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

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#888888")
      .text(`Issued via KHABI-TEQ · ${formatDate(issuedAt)}`, 50, doc.page.height - 55, {
        width: contentWidth,
        align: "center",
      });

    doc.end();
  });
}

export async function generateAndStoreRegistrationCertificate(
  reg: ITransactionRegistrationDoc,
  issuedByAdminId?: Types.ObjectId | string
): Promise<{ certificateNumber: string; certificateUrl: string }> {
  const config = await getLasreraCertificateConfig();
  const certificateNumber = reg.certificateNumber || generateCertificateNumber(String(reg._id));
  const pdfBuffer = await buildCertificatePdf(reg, certificateNumber, config);
  const base64 = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
  const filename = `lasrera-certificate-${String(reg._id).slice(-8)}`;

  const upload = await uploadFile(
    base64,
    filename,
    "lasrera/certificates",
    "raw",
    { format: "pdf" }
  );

  reg.certificateNumber = certificateNumber;
  reg.certificateUrl = upload.secure_url;
  reg.certificateIssuedAt = new Date();
  if (issuedByAdminId) {
    reg.certificateIssuedBy = new Types.ObjectId(String(issuedByAdminId));
  }
  reg.status = "certificate_issued";
  await reg.save();

  return { certificateNumber, certificateUrl: upload.secure_url };
}
