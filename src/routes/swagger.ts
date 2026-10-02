import { Router, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "../config/swagger";

const router = Router();

router.get("/swagger.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  return res.send(swaggerSpec);
});

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Khabiteq API Docs",
  })
);

export default router;
