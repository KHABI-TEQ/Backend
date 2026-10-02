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
        url: "http://localhost:5050",
        description: "Development server",
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
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/controllers/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
