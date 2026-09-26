import { Types } from "mongoose";
import { DB } from "../controllers";
import { RouteError } from "../common/classes";
import HttpStatusCodes from "../common/HttpStatusCodes";
import {
  BRM_BOOK_ROLE_LABEL,
  BRM_BOOK_USER_TYPES,
  isBrmBookUserType,
  type BrmBookUserType,
} from "../common/constants/brmBook";

export type PractitionerJourneyEventCode =
  | "BRM_CONNECTED"
  | "LISTING_CREATED"
  | "INSPECTION_REQUESTED"
  | "INSPECTION_COMPLETED"
  | "PROFESSIONAL_ENGAGED"
  | "PROFESSIONAL_DELIVERED"
  | "TRANSACTION_REGISTERED"
  | "CERTIFICATE_ISSUED";

export type PractitionerJourneyEvent = {
  code: PractitionerJourneyEventCode;
  title: string;
  occurredAt: Date;
  source: string;
  referenceId?: string;
};

const OPEN_REGISTRATION_STATUSES = [
  "submitted",
  "pending_completion",
  "khabiteq_verified",
  "forwarded_to_lasrera",
  "info_requested",
  "approved",
];

function asId(value: unknown): string {
  return String(value || "").trim();
}

function asObjectIdList(values: readonly unknown[]): Types.ObjectId[] {
  const ids: Types.ObjectId[] = [];
  for (const value of values) {
    const text = String(value ?? "");
    if (Types.ObjectId.isValid(text)) ids.push(new Types.ObjectId(text));
  }
  return ids;
}

function listingLabel(listing: {
  propertyType?: string;
  briefType?: string;
  propertyCode?: string;
}): string {
  const name = [listing.propertyType, listing.briefType].filter(Boolean).join(" · ");
  return name || listing.propertyCode || "Listing";
}

function displayName(user: any): string {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || "Practitioner";
}

export function publicBrmCard(brm: any) {
  if (!brm) return null;
  return {
    id: String(brm._id),
    fullName: brm.fullName,
    profilePicture: brm.profilePicture || null,
    phoneNumber: brm.phoneNumber || null,
    gender: brm.gender || null,
    serviceMessage: brm.serviceMessage || null,
    isActive: brm.isActive !== false,
  };
}

function event(
  code: PractitionerJourneyEventCode,
  title: string,
  occurredAt: Date | string | undefined,
  source: string,
  referenceId?: string
): PractitionerJourneyEvent | null {
  if (!occurredAt) return null;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return null;
  return { code, title, occurredAt: date, source, referenceId };
}

async function requireBrm(brmId: string) {
  if (!Types.ObjectId.isValid(brmId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid BRM id");
  }
  const brm = await DB.Models.BusinessRelationManager.findById(brmId).lean();
  if (!brm) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "BRM not found");
  }
  return brm;
}

async function propertyRowsForUser(userId: string) {
  return DB.Models.Property.find({
    $or: [{ createdBy: userId }, { owner: userId }],
  })
    .select("propertyType propertyCode briefType status createdAt")
    .sort({ createdAt: -1 })
    .lean();
}

async function professionalWorkForUser(user: any) {
  const userId = String(user._id);
  const [documents, surveys, catalog] = await Promise.all([
    user.userType === "Lawyer"
      ? DB.Models.DocumentVerification.find({ lawyerId: userId })
          .sort({ createdAt: -1 })
          .select("docCode status inspectionId propertyId preferenceId createdAt updatedAt")
          .lean()
      : Promise.resolve([]),
    user.userType === "Surveyor"
      ? DB.Models.SurveyRequest.find({ surveyorId: userId })
          .sort({ createdAt: -1 })
          .select("serviceType status inspectionId propertyId preferenceId createdAt updatedAt")
          .lean()
      : Promise.resolve([]),
    DB.Models.ProfessionalServiceRequest.find({ professionalId: userId })
      .sort({ createdAt: -1 })
      .select(
        "reference serviceName category status fulfillment inspectionId propertyId preferenceId createdAt updatedAt deliveredAt"
      )
      .lean(),
  ]);

  return { documents, surveys, catalog };
}

function jobInspectionIds(work: {
  documents: any[];
  surveys: any[];
  catalog: any[];
}): Types.ObjectId[] {
  const ids = [
    ...work.documents.map((row) => row.inspectionId),
    ...work.surveys.map((row) => row.inspectionId),
    ...work.catalog.map((row) => row.inspectionId),
  ]
    .filter(Boolean)
    .map((id) => String(id));
  return [...new Set(ids)]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
}

export async function registrationMatchForUsers(users: any[]) {
  if (!users.length) {
    return { filter: null as Record<string, unknown> | null, userIds: [] as string[] };
  }

  const userIds = users.map((user) => String(user._id));
  const emails = users
    .map((user) => String(user.email || "").toLowerCase().trim())
    .filter(Boolean);

  const [properties, agents, workSets] = await Promise.all([
    DB.Models.Property.find({
      $or: [{ createdBy: { $in: userIds } }, { owner: { $in: userIds } }],
    })
      .select("_id")
      .lean(),
    DB.Models.Agent.find({ userId: { $in: userIds } }).select("_id").lean(),
    Promise.all(users.map((user) => professionalWorkForUser(user))),
  ]);

  const inspectionIds = workSets.flatMap((work) => jobInspectionIds(work));
  const or: Record<string, unknown>[] = [];
  if (properties.length) or.push({ propertyId: { $in: properties.map((row) => row._id) } });
  if (agents.length) or.push({ agentId: { $in: agents.map((row) => row._id) } });
  if (emails.length) or.push({ "practitioner.email": { $in: emails } });
  if (inspectionIds.length) or.push({ inspectionId: { $in: inspectionIds } });

  return { filter: or.length ? { $or: or } : null, userIds };
}

async function registrationsForUser(user: any, propertyIds: Types.ObjectId[], work: {
  documents: any[];
  surveys: any[];
  catalog: any[];
}) {
  const or: Record<string, unknown>[] = [];
  if (propertyIds.length) or.push({ propertyId: { $in: propertyIds } });
  if (user.userType === "Agent") {
    const agent = await DB.Models.Agent.findOne({ userId: user._id }).select("_id").lean();
    if (agent?._id) or.push({ agentId: agent._id });
  }
  const email = String(user.email || "").toLowerCase().trim();
  if (email) or.push({ "practitioner.email": email });
  const inspectionIds = jobInspectionIds(work);
  if (inspectionIds.length) or.push({ inspectionId: { $in: inspectionIds } });
  if (!or.length) return [];

  return DB.Models.TransactionRegistration.find({ $or: or })
    .sort({ createdAt: -1 })
    .select(
      "status transactionType transactionReference propertyCode propertyLocationLabel certificateStatus certificateIssuedAt inspectionId createdAt"
    )
    .lean();
}

async function inspectionsForUser(
  userId: string,
  propertyIds: Types.ObjectId[],
  linkedInspectionIds: Types.ObjectId[]
) {
  const or: Record<string, unknown>[] = [{ owner: userId }];
  if (propertyIds.length) or.push({ propertyId: { $in: propertyIds } });
  if (linkedInspectionIds.length) or.push({ _id: { $in: linkedInspectionIds } });

  return DB.Models.InspectionBooking.find({ $or: or })
    .sort({ createdAt: -1 })
    .select(
      "status stage inspectionDate inspectionTime propertyId dueDiligencePath wishToProceed createdAt updatedAt inspectionReport"
    )
    .lean();
}

function journeySummary(input: {
  listings: number;
  inspections: number;
  professionalJobs: number;
  registrations: number;
  openRegistrations: number;
  certificatesIssued: number;
  latestActivityAt: Date | null;
}) {
  return input;
}

function latestDate(dates: Array<Date | string | undefined | null>): Date | null {
  const valid = dates
    .map((value) => (value ? new Date(value) : null))
    .filter((value): value is Date => Boolean(value && !Number.isNaN(value.getTime())));
  if (!valid.length) return null;
  return valid.sort((a, b) => b.getTime() - a.getTime())[0];
}

export async function getBrmBookCounts(brmIds: string[]) {
  const valid = brmIds.filter((id) => Types.ObjectId.isValid(id));
  if (!valid.length) return new Map<string, { total: number; byRole: Record<string, number> }>();

  const rows = await DB.Models.User.aggregate([
    {
      $match: {
        brmId: { $in: valid.map((id) => new Types.ObjectId(id)) },
        isDeleted: { $ne: true },
        userType: { $in: [...BRM_BOOK_USER_TYPES] },
      },
    },
    {
      $group: {
        _id: { brmId: "$brmId", userType: "$userType" },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = new Map<string, { total: number; byRole: Record<string, number> }>();
  for (const row of rows) {
    const brmId = String(row._id.brmId);
    const current = map.get(brmId) || { total: 0, byRole: {} };
    current.byRole[row._id.userType] = row.count;
    current.total += row.count;
    map.set(brmId, current);
  }
  return map;
}

export async function listBrmBook(params: {
  brmId: string;
  userType?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const brm = await requireBrm(params.brmId);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    brmId: brm._id,
    isDeleted: { $ne: true },
    userType: { $in: [...BRM_BOOK_USER_TYPES] },
  };
  if (params.userType && isBrmBookUserType(params.userType)) {
    filter.userType = params.userType;
  }
  if (params.search?.trim()) {
    const regex = new RegExp(params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { phoneNumber: regex },
      { accountId: regex },
    ];
  }

  const [users, total] = await Promise.all([
    DB.Models.User.find(filter)
      .select("firstName lastName email phoneNumber userType accountId accountStatus brmId brmAssignedAt createdAt")
      .sort({ brmAssignedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DB.Models.User.countDocuments(filter),
  ]);

  const book = await Promise.all(
    users.map(async (user) => {
      const [properties, work] = await Promise.all([
        propertyRowsForUser(String(user._id)),
        professionalWorkForUser(user),
      ]);
      const propertyIds = asObjectIdList(properties.map((row) => row._id));
      const registrations = await registrationsForUser(user, propertyIds, work);
      const inspections = await inspectionsForUser(
        String(user._id),
        propertyIds,
        jobInspectionIds(work)
      );
      const professionalJobs = work.documents.length + work.surveys.length + work.catalog.length;
      const openRegistrations = registrations.filter((row) =>
        OPEN_REGISTRATION_STATUSES.includes(String(row.status || ""))
      ).length;
      const certificatesIssued = registrations.filter(
        (row) => row.status === "certificate_issued" || row.status === "completed"
      ).length;

      return {
        userId: String(user._id),
        accountId: user.accountId,
        fullName: displayName(user),
        email: user.email,
        phoneNumber: user.phoneNumber || null,
        userType: user.userType,
        roleLabel: BRM_BOOK_ROLE_LABEL[user.userType as BrmBookUserType] || user.userType,
        accountStatus: user.accountStatus,
        connectedAt: (user as any).brmAssignedAt || user.createdAt,
        summary: journeySummary({
          listings: properties.length,
          inspections: inspections.length,
          professionalJobs,
          registrations: registrations.length,
          openRegistrations,
          certificatesIssued,
          latestActivityAt: latestDate([
            properties[0]?.createdAt,
            inspections[0]?.createdAt,
            work.documents[0]?.createdAt,
            work.surveys[0]?.createdAt,
            work.catalog[0]?.createdAt,
            registrations[0]?.createdAt,
            (user as any).brmAssignedAt,
          ]),
        }),
      };
    })
  );

  const counts = await getBrmBookCounts([String(brm._id)]);
  const bookCounts = counts.get(String(brm._id)) || { total: 0, byRole: {} };

  return {
    brm: publicBrmCard(brm),
    book: {
      total: bookCounts.total,
      byRole: bookCounts.byRole,
    },
    practitioners: book,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getPractitionerJourney(params: {
  userId: string;
  expectedBrmId?: string;
}) {
  if (!Types.ObjectId.isValid(params.userId)) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Invalid user id");
  }

  const user = await DB.Models.User.findById(params.userId)
    .select("-password -googleId -facebookId")
    .lean();
  if (!user || user.isDeleted) {
    throw new RouteError(HttpStatusCodes.NOT_FOUND, "Practitioner not found");
  }
  if (!isBrmBookUserType(user.userType)) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Transaction journey tracking is available for agents, developers, lawyers, valuers, and surveyors."
    );
  }
  if (!user.brmId) {
    throw new RouteError(
      HttpStatusCodes.NOT_FOUND,
      "This practitioner is not connected to a BRM."
    );
  }
  if (params.expectedBrmId && String(user.brmId) !== String(params.expectedBrmId)) {
    throw new RouteError(
      HttpStatusCodes.FORBIDDEN,
      "This practitioner is not on that BRM book."
    );
  }

  const brm = await DB.Models.BusinessRelationManager.findById(user.brmId).lean();
  const [properties, work] = await Promise.all([
    propertyRowsForUser(String(user._id)),
    professionalWorkForUser(user),
  ]);
  const propertyIds = asObjectIdList(properties.map((row) => row._id));
  const [registrations, inspections] = await Promise.all([
    registrationsForUser(user, propertyIds, work),
    inspectionsForUser(String(user._id), propertyIds, jobInspectionIds(work)),
  ]);

  const events: PractitionerJourneyEvent[] = [];
  const connected = event(
    "BRM_CONNECTED",
    `Connected to BRM${brm?.fullName ? ` · ${brm.fullName}` : ""}`,
    (user as any).brmAssignedAt || user.createdAt,
    "brm",
    String(user.brmId)
  );
  if (connected) events.push(connected);

  for (const listing of properties.slice(0, 40)) {
    const created = event(
      "LISTING_CREATED",
      listingLabel(listing),
      listing.createdAt,
      "listing",
      String(listing._id)
    );
    if (created) events.push(created);
  }

  for (const inspection of inspections.slice(0, 40)) {
    const requested = event(
      "INSPECTION_REQUESTED",
      "Inspection requested",
      inspection.createdAt,
      "inspection",
      String(inspection._id)
    );
    if (requested) events.push(requested);
    const completedAt =
      inspection.inspectionReport?.inspectionCompletedAt ||
      (inspection.status === "completed" || inspection.stage === "completed"
        ? inspection.updatedAt
        : undefined);
    const completed = event(
      "INSPECTION_COMPLETED",
      "Inspection completed",
      completedAt,
      "inspection",
      String(inspection._id)
    );
    if (completed) events.push(completed);
  }

  const jobs = [
    ...work.catalog.map((row) => ({
      id: String(row._id),
      createdAt: row.createdAt,
      deliveredAt: row.deliveredAt || (["delivered", "completed"].includes(String(row.status)) ? row.updatedAt : undefined),
      label: row.serviceName || "Professional service",
    })),
    ...work.documents.map((row) => ({
      id: String(row._id),
      createdAt: row.createdAt,
      deliveredAt: ["registered", "completed", "approved"].includes(String(row.status)) ? row.updatedAt : undefined,
      label: `Document verification${row.docCode ? ` · ${row.docCode}` : ""}`,
    })),
    ...work.surveys.map((row) => ({
      id: String(row._id),
      createdAt: row.createdAt,
      deliveredAt: ["completed", "approved"].includes(String(row.status)) ? row.updatedAt : undefined,
      label: row.serviceType === "site-survey" ? "Site survey" : "Plan verification",
    })),
  ];

  for (const job of jobs.slice(0, 40)) {
    const engaged = event("PROFESSIONAL_ENGAGED", job.label, job.createdAt, "professional", job.id);
    if (engaged) events.push(engaged);
    const delivered = event(
      "PROFESSIONAL_DELIVERED",
      `${job.label} delivered`,
      job.deliveredAt,
      "professional",
      job.id
    );
    if (delivered) events.push(delivered);
  }

  for (const registration of registrations.slice(0, 40)) {
    const registered = event(
      "TRANSACTION_REGISTERED",
      registration.transactionReference || "Transaction registered",
      registration.createdAt,
      "registration",
      String(registration._id)
    );
    if (registered) events.push(registered);
    const issued = event(
      "CERTIFICATE_ISSUED",
      "Certificate issued",
      registration.certificateIssuedAt,
      "certificate",
      String(registration._id)
    );
    if (issued) events.push(issued);
  }

  events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const professionalJobs = work.documents.length + work.surveys.length + work.catalog.length;
  const openRegistrations = registrations.filter((row) =>
    OPEN_REGISTRATION_STATUSES.includes(String(row.status || ""))
  ).length;
  const certificatesIssued = registrations.filter(
    (row) => row.status === "certificate_issued" || row.status === "completed"
  ).length;

  return {
    practitioner: {
      userId: String(user._id),
      accountId: user.accountId,
      fullName: displayName(user),
      email: user.email,
      phoneNumber: user.phoneNumber || null,
      userType: user.userType,
      roleLabel: BRM_BOOK_ROLE_LABEL[user.userType as BrmBookUserType],
      accountStatus: user.accountStatus,
      connectedAt: (user as any).brmAssignedAt || null,
    },
    brm: publicBrmCard(brm),
    summary: journeySummary({
      listings: properties.length,
      inspections: inspections.length,
      professionalJobs,
      registrations: registrations.length,
      openRegistrations,
      certificatesIssued,
      latestActivityAt: latestDate(events.map((row) => row.occurredAt)),
    }),
    timeline: events,
    listings: properties.map((row) => ({
      id: String(row._id),
      title: listingLabel(row),
      propertyCode: row.propertyCode || null,
      status: row.status,
      briefType: row.briefType,
      createdAt: row.createdAt,
    })),
    inspections: inspections.map((row) => ({
      id: String(row._id),
      status: row.status,
      stage: row.stage,
      inspectionDate: row.inspectionDate,
      dueDiligencePath: row.dueDiligencePath || null,
      wishToProceed: row.wishToProceed,
      createdAt: row.createdAt,
    })),
    professionalWork: {
      catalog: work.catalog.map((row) => ({
        id: String(row._id),
        reference: row.reference,
        serviceName: row.serviceName,
        category: row.category,
        status: row.status,
        inspectionId: row.inspectionId ? String(row.inspectionId) : null,
        createdAt: row.createdAt,
      })),
      documents: work.documents.map((row) => ({
        id: String(row._id),
        docCode: row.docCode,
        status: row.status,
        inspectionId: row.inspectionId ? String(row.inspectionId) : null,
        createdAt: row.createdAt,
      })),
      surveys: work.surveys.map((row) => ({
        id: String(row._id),
        serviceType: row.serviceType,
        status: row.status,
        inspectionId: row.inspectionId ? String(row.inspectionId) : null,
        createdAt: row.createdAt,
      })),
    },
    registrations: registrations.map((row) => ({
      id: String(row._id),
      transactionReference: row.transactionReference || null,
      status: row.status,
      transactionType: row.transactionType,
      propertyCode: row.propertyCode || null,
      property: row.propertyLocationLabel || null,
      certificateStatus: row.certificateStatus || null,
      createdAt: row.createdAt,
    })),
  };
}

export async function enrichRegistrationWithBrmParticipants(registration: any) {
  const userIds = new Set<string>();
  const property = registration.propertyId;
  if (property?.owner) userIds.add(asId(property.owner));
  if (property?.createdBy) userIds.add(asId(property.createdBy));
  const agentUserId = registration.agentId?.userId?._id || registration.agentId?.userId;
  if (agentUserId) userIds.add(asId(agentUserId));

  if (registration.inspectionId) {
    const inspectionId = asId(registration.inspectionId?._id || registration.inspectionId);
    const [docs, surveys, catalog] = await Promise.all([
      DB.Models.DocumentVerification.find({ inspectionId }).select("lawyerId").lean(),
      DB.Models.SurveyRequest.find({ inspectionId }).select("surveyorId").lean(),
      DB.Models.ProfessionalServiceRequest.find({ inspectionId }).select("professionalId").lean(),
    ]);
    for (const row of docs) if (row.lawyerId) userIds.add(asId(row.lawyerId));
    for (const row of surveys) if (row.surveyorId) userIds.add(asId(row.surveyorId));
    for (const row of catalog) if (row.professionalId) userIds.add(asId(row.professionalId));
  }

  const email = String(registration.practitioner?.email || "").toLowerCase().trim();
  const users = await DB.Models.User.find({
    $or: [
      ...(userIds.size ? [{ _id: { $in: [...userIds] } }] : []),
      ...(email ? [{ email }] : []),
    ],
    brmId: { $exists: true, $ne: null },
    userType: { $in: [...BRM_BOOK_USER_TYPES] },
    isDeleted: { $ne: true },
  })
    .select("firstName lastName email userType brmId")
    .populate("brmId", "fullName profilePicture phoneNumber isActive")
    .lean();

  return users.map((user) => ({
    userId: String(user._id),
    fullName: displayName(user),
    email: user.email,
    userType: user.userType,
    roleLabel: BRM_BOOK_ROLE_LABEL[user.userType as BrmBookUserType] || user.userType,
    brm: publicBrmCard(user.brmId),
  }));
}
