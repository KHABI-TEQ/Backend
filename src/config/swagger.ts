import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Khabiteq Backend API",
      version: "1.0.0",
      description: "API documentation for Khabiteq Backend",
      contact: {
        name: "Khabiteq Team",
      },
    },
    servers: [
      {
        url: "http://localhost:5050/api",
        description: "API server (with /api base route)",
      },
      {
        url: "http://localhost:5050",
        description: "Root server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phoneNumber: { type: "string" },
            userType: { type: "string" },
            isAccountVerified: { type: "boolean" },
            accountApproved: { type: "boolean" },
            profile_picture: { type: "string" },
          },
        },
        Property: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            price: { type: "number" },
            status: { type: "string" },
            propertyType: { type: "string" },
            location: { type: "object" },
            pictures: { type: "array", items: { type: "string" } },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            total: { type: "number" },
            page: { type: "number" },
            limit: { type: "number" },
            totalPages: { type: "number" },
          },
        },
        Petition: {
          type: "object",
          properties: {
            _id: { type: "string" },
            petitionNumber: { type: "string", example: "PET-2026-00001" },
            registrationId: { type: "string" },
            transactionReference: { type: "string", example: "TRX-20260320-ABCD" },
            buyerId: { type: "string" },
            buyer: {
              type: "object",
              properties: {
                fullName: { type: "string" },
                email: { type: "string" },
                phoneNumber: { type: "string" },
              },
            },
            respondent: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phoneNumber: { type: "string" },
                type: { type: "string", enum: ["developer", "agent", "property_owner", "other"] },
              },
            },
            subject: { type: "string" },
            description: { type: "string" },
            amountInvolved: { type: "number" },
            status: {
              type: "string",
              enum: ["submitted", "case_opened", "dismissed"],
              example: "submitted",
            },
            submittedAt: { type: "string", format: "date-time" },
            caseId: { type: "string", nullable: true },
          },
        },
        Case: {
          type: "object",
          properties: {
            _id: { type: "string" },
            caseNumber: { type: "string", example: "CAS-2026-00001" },
            petitionId: { type: "string" },
            registrationId: { type: "string" },
            transactionReference: { type: "string" },
            status: {
              type: "string",
              enum: ["case_opened", "mediation", "transferred_to_efcc", "closed"],
              example: "case_opened",
            },
            assignedOfficer: { type: "string", nullable: true },
            milestones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  stage: { type: "string" },
                  occurredAt: { type: "string", format: "date-time" },
                  by: { type: "string" },
                },
              },
            },
            openedAt: { type: "string", format: "date-time" },
            lastActivityAt: { type: "string", format: "date-time" },
            closedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        CaseCommunication: {
          type: "object",
          properties: {
            _id: { type: "string" },
            caseId: { type: "string" },
            direction: { type: "string", enum: ["outbound", "inbound"] },
            type: { type: "string", enum: ["information_request", "buyer_response", "general_notice"] },
            subject: { type: "string" },
            message: { type: "string" },
            deliveryStatus: { type: "string", enum: ["pending", "sent", "failed"] },
            responseStatus: { type: "string", enum: ["awaiting", "responded", "not_required"] },
            sentAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/controllers/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
