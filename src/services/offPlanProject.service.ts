import { Types } from "mongoose";
import { DB } from "../controllers";
import HttpStatusCodes from "../common/HttpStatusCodes";
import { RouteError } from "../common/classes";
import type { OffPlanProjectStatus } from "../models/offPlanProject";
import { isDeveloperFullyVerified, ensureDeveloperProfile } from "./developerVerification.service";
import { getDeveloperPlanEntitlement } from "./developerPlanEntitlement.service";

export type ProjectInput = {
  name: string;
  location?: {
    state?: string;
    localGovtArea?: string;
    area?: string;
    streetAddress?: string;
  };
  developmentType?: string;
  developmentStage?: string;
  unitCount?: number;
  unitTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  expectedCompletionDate?: string;
  availableUnits?: number;
  documents?: { name: string; url: string }[];
};

async function assertCanSubmitOffPlan(userId: string) {
  const { profile } = await ensureDeveloperProfile(userId);
  if (!isDeveloperFullyVerified(profile)) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "Complete Developer Verification (identity, address, and company where required) before submitting an off-plan project."
    );
  }
  const entitlement = await getDeveloperPlanEntitlement(userId);
  if (!entitlement.allowsOffPlan) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "An Off-Plan plan is required to submit an off-plan project. The Distribution plan covers completed properties only."
    );
  }
}

export async function listDeveloperProjects(userId: string) {
  return DB.Models.OffPlanProject.find({ developerId: userId }).sort({ updatedAt: -1 }).lean();
}

export async function getDeveloperProject(userId: string, id: string) {
  const project = await DB.Models.OffPlanProject.findOne({
    _id: id,
    developerId: userId,
  }).lean();
  if (!project) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Off-plan project not found.");
  }
  return project;
}

export async function createDeveloperProject(userId: string, body: ProjectInput) {
  if (!body.name?.trim()) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Project name is required.");
  }
  const created = await DB.Models.OffPlanProject.create({
    developerId: userId,
    name: body.name.trim(),
    location: body.location || {},
    developmentType: body.developmentType,
    developmentStage: body.developmentStage,
    unitCount: body.unitCount,
    unitTypes: body.unitTypes || [],
    priceMin: body.priceMin,
    priceMax: body.priceMax,
    expectedCompletionDate: body.expectedCompletionDate,
    availableUnits: body.availableUnits,
    documents: body.documents || [],
    status: "draft",
  });
  return created.toObject();
}

export async function updateDeveloperProject(userId: string, id: string, body: ProjectInput) {
  const project = await DB.Models.OffPlanProject.findOne({ _id: id, developerId: userId });
  if (!project) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Off-plan project not found.");
  }
  if (!["draft", "rejected"].includes(project.status)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Only draft or rejected projects can be edited."
    );
  }
  Object.assign(project, {
    name: body.name?.trim() || project.name,
    location: body.location || project.location,
    developmentType: body.developmentType ?? project.developmentType,
    developmentStage: body.developmentStage ?? project.developmentStage,
    unitCount: body.unitCount ?? project.unitCount,
    unitTypes: body.unitTypes ?? project.unitTypes,
    priceMin: body.priceMin ?? project.priceMin,
    priceMax: body.priceMax ?? project.priceMax,
    expectedCompletionDate: body.expectedCompletionDate ?? project.expectedCompletionDate,
    availableUnits: body.availableUnits ?? project.availableUnits,
    documents: body.documents ?? project.documents,
    status: "draft",
    reviewNote: undefined,
  });
  await project.save();
  return project.toObject();
}

export async function submitDeveloperProject(userId: string, id: string) {
  await assertCanSubmitOffPlan(userId);
  const project = await DB.Models.OffPlanProject.findOne({ _id: id, developerId: userId });
  if (!project) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Off-plan project not found.");
  }
  if (!project.name || !project.location?.localGovtArea || !project.developmentStage) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Add the project name, LGA, and development stage before submitting."
    );
  }
  project.status = "submitted";
  project.submittedAt = new Date();
  await project.save();
  return project.toObject();
}

async function upsertMarketplaceProjection(project: {
  _id: Types.ObjectId;
  developerId: Types.ObjectId;
  name: string;
  location?: { state?: string; localGovtArea?: string; area?: string; streetAddress?: string };
  developmentStage?: string;
  expectedCompletionDate?: string;
  priceMin?: number;
  marketplacePropertyId?: Types.ObjectId;
}) {
  const payload = {
    propertyType: "off-plan",
    briefType: "Off-Plan",
    propertyCategory: "residential",
    owner: project.developerId,
    ownerModel: "User" as const,
    createdByRole: "user" as const,
    areYouTheOwner: true,
    description: project.name,
    price: project.priceMin || 0,
    location: {
      state: project.location?.state,
      localGovernment: project.location?.localGovtArea,
      area: project.location?.area,
      streetAddress: project.location?.streetAddress,
    },
    expectedCompletionDate: project.expectedCompletionDate,
    developmentStage: project.developmentStage,
    offPlanProjectId: project._id,
    status: "approved",
    isApproved: true,
    isAvailable: true,
    isDeleted: false,
  };

  if (project.marketplacePropertyId) {
    await DB.Models.Property.findByIdAndUpdate(project.marketplacePropertyId, {
      $set: payload,
    });
    return project.marketplacePropertyId;
  }

  const created = await DB.Models.Property.create(payload);
  return created._id;
}

export async function adminReviewProject(
  projectId: string,
  response: "approve" | "reject",
  note: string | undefined,
  adminId?: string
) {
  const project = await DB.Models.OffPlanProject.findById(projectId);
  if (!project) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Off-plan project not found.");
  }
  if (response === "reject") {
    project.status = "rejected";
    project.reviewNote = note?.trim();
    project.reviewedAt = new Date();
    if (adminId) project.reviewedBy = new Types.ObjectId(adminId);
    await project.save();
    return project.toObject();
  }

  project.status = "approved";
  project.reviewNote = note?.trim();
  project.reviewedAt = new Date();
  if (adminId) project.reviewedBy = new Types.ObjectId(adminId);
  await project.save();
  return project.toObject();
}

export async function publishApprovedProject(projectId: string) {
  const project = await DB.Models.OffPlanProject.findById(projectId);
  if (!project) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Off-plan project not found.");
  }
  if (project.status !== "approved" && project.status !== "live") {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Only approved projects can go live.");
  }
  const propertyId = await upsertMarketplaceProjection({
    _id: project._id as Types.ObjectId,
    developerId: project.developerId as Types.ObjectId,
    name: String(project.name),
    location: project.location,
    developmentStage: project.developmentStage,
    expectedCompletionDate: project.expectedCompletionDate,
    priceMin: project.priceMin,
    marketplacePropertyId: project.marketplacePropertyId as Types.ObjectId | undefined,
  });
  project.marketplacePropertyId = propertyId as Types.ObjectId;
  project.status = "live";
  project.liveAt = new Date();
  await project.save();
  return project.toObject();
}

export async function listPendingProjects() {
  return DB.Models.OffPlanProject.find({
    status: { $in: ["submitted", "under_review"] },
  })
    .sort({ submittedAt: -1, updatedAt: -1 })
    .populate("developerId", "firstName lastName email phoneNumber")
    .lean();
}

export async function getAdminProject(id: string) {
  const project = await DB.Models.OffPlanProject.findById(id)
    .populate("developerId", "firstName lastName email phoneNumber")
    .lean();
  if (!project) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Off-plan project not found.");
  }
  if (project.status === "submitted") {
    await DB.Models.OffPlanProject.updateOne({ _id: id }, { $set: { status: "under_review" } });
  }
  return project;
}

export function projectCounts(rows: { status: OffPlanProjectStatus }[]) {
  const counts = {
    total: rows.length,
    draft: 0,
    underReview: 0,
    approved: 0,
    live: 0,
    requiresAttention: 0,
  };
  for (const row of rows) {
    if (row.status === "draft") counts.draft += 1;
    else if (row.status === "submitted" || row.status === "under_review") counts.underReview += 1;
    else if (row.status === "approved") counts.approved += 1;
    else if (row.status === "live") counts.live += 1;
    else if (row.status === "rejected") counts.requiresAttention += 1;
  }
  return counts;
}
