import express from "express";
import { requirePermission } from "../middlewares/authorizationMiddleware";
import { PERMISSIONS } from "../common/constants/permissions";
import { validateJoi } from "../middlewares/validateJoi";
import {
  openCaseSchema,
  updateCaseStatusSchema,
  assignOfficerSchema,
  saveMediationNoteSchema,
  sendRequestInfoSchema,
  efccTransferSchema,
  closeCaseSchema,
} from "../validators/case.validator";

import {
  listPetitions,
  getPetition,
  openCase,
} from "../controllers/Admin/Cases/adminPetitions";

import {
  listCases,
  getCaseAuditLog,
  getCaseById,
  updateCaseStatus,
  assignOfficer,
  getCasePetition,
  getCaseDigitalTrail,
  getCaseEvidence,
  getCaseCommunications,
  getCaseActivity,
  getCaseRecordPdf,
} from "../controllers/Admin/Cases/adminCases";

import {
  getMediationPanel,
  saveMediationNote,
} from "../controllers/Admin/Cases/adminCaseMediation";

import {
  previewRequestInfo,
  sendRequestInfo,
  markCommunicationResponded,
} from "../controllers/Admin/Cases/adminCaseRequestInfo";

import {
  previewEfccTransfer,
  sendEfccTransfer,
  listEfccTransfers,
  retryEfccTransfer,
} from "../controllers/Admin/Cases/adminCaseEfccTransfer";

import { closeCase } from "../controllers/Admin/Cases/adminCaseClose";

const AdminCasesRouter = express.Router();

/**
 * PETITIONS ENDPOINTS
 */
AdminCasesRouter.get(
  "/petitions",
  requirePermission(PERMISSIONS.PETITION_VIEW),
  listPetitions
);

AdminCasesRouter.get(
  "/petitions/:id",
  requirePermission(PERMISSIONS.PETITION_VIEW),
  getPetition
);

AdminCasesRouter.post(
  "/petitions/:id/open-case",
  requirePermission(PERMISSIONS.PETITION_MANAGE),
  validateJoi(openCaseSchema),
  openCase
);

/**
 * CASES ENDPOINTS
 * IMPORTANT: /cases/audit-log MUST precede /cases/:id
 */
AdminCasesRouter.get(
  "/cases/audit-log",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseAuditLog
);

AdminCasesRouter.get(
  "/cases",
  requirePermission(PERMISSIONS.CASE_VIEW),
  listCases
);

AdminCasesRouter.get(
  "/cases/:id",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseById
);

AdminCasesRouter.patch(
  "/cases/:id/status",
  requirePermission(PERMISSIONS.CASE_VIEW),
  validateJoi(updateCaseStatusSchema),
  updateCaseStatus
);

AdminCasesRouter.post(
  "/cases/:id/assign",
  requirePermission(PERMISSIONS.CASE_ASSIGN),
  validateJoi(assignOfficerSchema),
  assignOfficer
);

AdminCasesRouter.get(
  "/cases/:id/petition",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCasePetition
);

AdminCasesRouter.get(
  "/cases/:id/digital-trail",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseDigitalTrail
);

AdminCasesRouter.get(
  "/cases/:id/evidence",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseEvidence
);

AdminCasesRouter.get(
  "/cases/:id/communications",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseCommunications
);

AdminCasesRouter.get(
  "/cases/:id/activity",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseActivity
);

AdminCasesRouter.get(
  "/cases/:id/case-record.pdf",
  requirePermission(PERMISSIONS.CASE_VIEW),
  getCaseRecordPdf
);

/**
 * MEDIATION ENDPOINTS
 */
AdminCasesRouter.get(
  "/cases/:id/mediation",
  requirePermission(PERMISSIONS.CASE_MEDIATE),
  getMediationPanel
);

AdminCasesRouter.post(
  "/cases/:id/mediation",
  requirePermission(PERMISSIONS.CASE_MEDIATE),
  validateJoi(saveMediationNoteSchema),
  saveMediationNote
);

/**
 * REQUEST INFORMATION ENDPOINTS
 */
AdminCasesRouter.get(
  "/cases/:id/request-information/preview",
  requirePermission(PERMISSIONS.CASE_REQUEST_INFO),
  previewRequestInfo
);

AdminCasesRouter.post(
  "/cases/:id/request-information",
  requirePermission(PERMISSIONS.CASE_REQUEST_INFO),
  validateJoi(sendRequestInfoSchema),
  sendRequestInfo
);

AdminCasesRouter.patch(
  "/cases/:id/communications/:commId/mark-responded",
  requirePermission(PERMISSIONS.CASE_REQUEST_INFO),
  markCommunicationResponded
);

/**
 * EFCC TRANSFER ENDPOINTS
 */
AdminCasesRouter.get(
  "/cases/:id/efcc-transfer/preview",
  requirePermission(PERMISSIONS.CASE_TRANSFER_EFCC),
  previewEfccTransfer
);

AdminCasesRouter.post(
  "/cases/:id/efcc-transfer",
  requirePermission(PERMISSIONS.CASE_TRANSFER_EFCC),
  validateJoi(efccTransferSchema),
  sendEfccTransfer
);

AdminCasesRouter.get(
  "/cases/:id/efcc-transfer",
  requirePermission(PERMISSIONS.CASE_TRANSFER_EFCC),
  listEfccTransfers
);

AdminCasesRouter.post(
  "/cases/:id/efcc-transfer/:transferId/retry",
  requirePermission(PERMISSIONS.CASE_TRANSFER_EFCC),
  retryEfccTransfer
);

/**
 * CLOSE CASE ENDPOINT
 */
AdminCasesRouter.post(
  "/cases/:id/close",
  requirePermission(PERMISSIONS.CASE_CLOSE),
  validateJoi(closeCaseSchema),
  closeCase
);

export default AdminCasesRouter;
