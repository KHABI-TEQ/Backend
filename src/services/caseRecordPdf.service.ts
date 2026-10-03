import PDFDocument from "pdfkit";
import { DB } from "../controllers";
import { uploadFile } from "../common/newCloudinary";
import { logCaseActivity } from "./caseActivity.service";
import { toAuthorizedCertificateView } from "./transactionCertificateRecord.service";

/**
 * Builds a comprehensive, multi-page A4 PDF case dossier for LASRERA arbitration or EFCC escalation.
 */
export async function buildCaseRecordPdf(
  caseId: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const caseDoc = await DB.Models.Case.findById(caseId)
    .populate("assignedOfficer", "firstName lastName email")
    .lean();

  if (!caseDoc) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const [petition, registration, mediationNotes, communications, activityLogs] =
    await Promise.all([
      DB.Models.Petition.findById(caseDoc.petitionId).lean(),
      DB.Models.TransactionRegistration.findById(caseDoc.registrationId).lean(),
      DB.Models.CaseMediationNote.find({ caseId: caseDoc._id })
        .populate("officer", "firstName lastName")
        .sort({ createdAt: 1 })
        .lean(),
      DB.Models.CaseCommunication.find({ caseId: caseDoc._id })
        .sort({ sentAt: 1 })
        .lean(),
      DB.Models.CaseActivityLog.find({ caseId: caseDoc._id })
        .sort({ createdAt: 1 })
        .lean(),
    ]);

  const certView = registration ? toAuthorizedCertificateView(registration as any) : null;
  const fileName = `${caseDoc.caseNumber || "CASE"}_Record_${Date.now()}.pdf`;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header Banner
      doc.rect(40, 40, 515, 50).fill("#0B423D");
      doc
        .fillColor("#FFFFFF")
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("LASRERA — OFFICIAL CASE RECORD DOSSIER", 55, 52, { width: 485 });
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          "Lagos State Real Estate Regulatory Authority | Dispute Resolution Directorate",
          55,
          72,
          { width: 485 }
        );

      doc.moveDown(2);
      let currentY = 105;

      const addSectionHeading = (title: string) => {
        if (currentY > 720) {
          doc.addPage();
          currentY = 45;
        }
        doc
          .rect(40, currentY, 515, 20)
          .fill("#F1F5F9");
        doc
          .fillColor("#0F172A")
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(title, 48, currentY + 5);
        currentY += 28;
      };

      const addRow = (label: string, value: string | undefined | null) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 45;
        }
        doc
          .fillColor("#475569")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(label, 48, currentY, { width: 150 });
        doc
          .fillColor("#0F172A")
          .fontSize(9)
          .font("Helvetica")
          .text(value || "—", 200, currentY, { width: 345 });
        currentY += 15;
      };

      // 1. Case Identification
      addSectionHeading("1. CASE IDENTIFICATION");
      addRow("Case Number:", caseDoc.caseNumber);
      addRow("Petition Number:", petition?.petitionNumber);
      addRow("Transaction Reference:", caseDoc.transactionReference);
      addRow("Current Status:", caseDoc.status?.toUpperCase());
      addRow(
        "Assigned Officer:",
        (caseDoc.assignedOfficer as any)
          ? `${(caseDoc.assignedOfficer as any).firstName} ${(caseDoc.assignedOfficer as any).lastName} (${(caseDoc.assignedOfficer as any).email})`
          : "Unassigned"
      );
      addRow("Opened At:", caseDoc.openedAt ? new Date(caseDoc.openedAt).toUTCString() : "—");
      if (caseDoc.closedAt) {
        addRow("Closed At:", new Date(caseDoc.closedAt).toUTCString());
        addRow("Closure Outcome:", caseDoc.closure?.outcome?.toUpperCase());
        addRow("Closure Summary:", caseDoc.closure?.summary);
      }
      currentY += 8;

      // 2. Parties
      addSectionHeading("2. PARTIES & PARTICIPANTS");
      addRow("Complainant / Buyer:", petition?.buyer?.fullName);
      addRow("Buyer Email:", petition?.buyer?.email);
      addRow("Buyer Phone:", petition?.buyer?.phoneNumber);
      addRow("Respondent Name:", petition?.respondent?.name);
      addRow("Respondent Type:", petition?.respondent?.type?.toUpperCase());
      addRow("Respondent Email:", petition?.respondent?.email);
      addRow("Respondent Phone:", petition?.respondent?.phoneNumber);

      if (certView?.participatingProfessionals?.length) {
        certView.participatingProfessionals.forEach((p, idx) => {
          addRow(
            `Professional #${idx + 1}:`,
            `${p.name} (${p.category}) — Licence: ${p.licenceNumber || "N/A"} [${p.verificationStatus || "unverified"}]`
          );
        });
      }
      currentY += 8;

      // 3. Transaction Details
      addSectionHeading("3. TRANSACTION DETAILS");
      addRow("Transaction Reference:", caseDoc.transactionReference);
      addRow("Amount in Dispute:", `NGN ${(petition?.amountInvolved || 0).toLocaleString()}`);
      if (certView) {
        addRow("Property Type:", certView.propertyType);
        addRow("Location:", certView.propertyLocation);
        addRow("Transaction Type:", certView.transactionType);
        addRow("Transaction Value:", `NGN ${((certView as any).transactionValue || (registration as any)?.transactionValue || 0).toLocaleString()}`);
      }
      currentY += 8;

      // 4. Petition Statement
      addSectionHeading("4. COMPLAINANT PETITION STATEMENT");
      addRow("Subject:", petition?.subject);
      addRow("Submitted At:", petition?.submittedAt ? new Date(petition.submittedAt).toUTCString() : "—");
      currentY += 4;
      if (petition?.description) {
        if (currentY > 700) {
          doc.addPage();
          currentY = 45;
        }
        doc
          .fillColor("#1E293B")
          .fontSize(9)
          .font("Helvetica")
          .text(petition.description, 48, currentY, { width: 500, lineGap: 3 });
        currentY += doc.heightOfString(petition.description, { width: 500, lineGap: 3 }) + 12;
      }
      if (petition?.attachments?.length) {
        addRow(
          "Attachments:",
          petition.attachments.map((a) => `${a.fileName}: ${a.url}`).join("\n")
        );
        currentY += 8;
      }

      // 5. Digital Transaction Trail
      if (certView?.journey?.length) {
        addSectionHeading("5. DIGITAL TRANSACTION TRAIL (JOURNEY EVENTS)");
        certView.journey.forEach((evt) => {
          addRow(`Step ${evt.step} [${evt.code}]:`, `${evt.title} — ${evt.date} ${evt.notApplicable ? "(N/A)" : ""}`);
        });
        currentY += 8;
      }

      // 6. Payment Confirmation & Trail
      if (certView?.paymentRecord?.length) {
        addSectionHeading("6. PAYMENT RECORDS & RECEIPTS");
        certView.paymentRecord.forEach((rec) => {
          const amt = rec.amount ? ` (NGN ${Number(rec.amount).toLocaleString()})` : "";
          addRow(`${rec.description}:`, `Status: ${rec.status} | Date: ${rec.date}${amt}`);
        });
        currentY += 8;
      }

      // 7. Evidence & Document Trail
      if (certView?.documentTrail?.length) {
        addSectionHeading("7. DOCUMENT TRAIL & REGISTERED EVIDENCE");
        certView.documentTrail.forEach((docItem) => {
          addRow(docItem.type, `Status: ${docItem.status}`);
        });
        currentY += 8;
      }

      // 8. LASRERA Mediation Notes
      const includeNotes = process.env.CASE_PDF_INCLUDE_MEDIATION_NOTES !== "false";
      if (includeNotes && mediationNotes.length > 0) {
        addSectionHeading("8. LASRERA MEDIATION NOTES");
        mediationNotes.forEach((note, idx) => {
          const officerName = (note.officer as any)
            ? `${(note.officer as any).firstName} ${(note.officer as any).lastName}`
            : "Officer";
          addRow(`Note #${idx + 1} (${new Date((note as any).createdAt).toUTCString()}):`, `Recorded by ${officerName}`);
          if (note.meetingNotes) addRow("Meeting Notes:", note.meetingNotes);
          if (note.partyResponses) addRow("Party Responses:", note.partyResponses);
          if (note.proposedResolution) addRow("Proposed Resolution:", note.proposedResolution);
          if (note.outcome) addRow("Outcome:", note.outcome);
          currentY += 5;
        });
        currentY += 8;
      }

      // 9. Case Correspondence / Communications
      if (communications.length > 0) {
        addSectionHeading("9. CASE CORRESPONDENCE & NOTICES");
        communications.forEach((comm, idx) => {
          addRow(
            `#${idx + 1} [${comm.direction.toUpperCase()} - ${comm.type}]:`,
            `${comm.subject} (${new Date(comm.sentAt).toUTCString()})`
          );
          addRow("Recipient:", `${comm.recipientName} <${comm.recipientEmail}>`);
          addRow("Message:", comm.message);
          currentY += 4;
        });
        currentY += 8;
      }

      // 10. Audit History
      if (activityLogs.length > 0) {
        addSectionHeading("10. CASE AUDIT LOG");
        activityLogs.slice(-20).forEach((log) => {
          addRow(
            `${new Date((log as any).createdAt).toUTCString()} [${log.action}]:`,
            `${log.actorLabel || log.actorType}: ${log.message}`
          );
        });
      }

      // Page numbers on all pages (two-pass)
      const range = doc.bufferedPageRange();
      const timestamp = new Date().toUTCString();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fillColor("#94A3B8")
          .fontSize(8)
          .font("Helvetica")
          .text(
            `${caseDoc.caseNumber} | Generated: ${timestamp} | Page ${i + 1} of ${range.count}`,
            40,
            doc.page.height - 25,
            { align: "center", width: 515 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  return { buffer, fileName };
}

/**
 * Generates the PDF, uploads it to Cloudinary, and logs the activity.
 */
export async function generateAndStoreCaseRecordPdf(
  caseId: string,
  officerId: string
): Promise<{ url: string; fileName: string }> {
  const { buffer, fileName } = await buildCaseRecordPdf(caseId);
  const caseDoc = await DB.Models.Case.findById(caseId);
  if (!caseDoc) throw new Error("Case not found");

  const folder = process.env.CASE_PDF_CLOUDINARY_FOLDER || "khabiteq/cases";
  const base64Data = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const publicId = fileName.replace(".pdf", "");

  const uploadRes = await uploadFile(base64Data, publicId, folder, "raw");
  const url = uploadRes.secure_url || uploadRes.url;

  await logCaseActivity({
    caseId: caseDoc._id as any,
    registrationId: caseDoc.registrationId as any,
    actorType: "Admin",
    actorId: officerId,
    actorLabel: "LASRERA Officer",
    action: "CASE_RECORD_PDF_GENERATED",
    visibility: "internal",
    message: `Generated case dossier PDF (${fileName})`,
    meta: { pdfUrl: url, fileName },
  });

  return { url, fileName };
}
