import express, { type Express, type IRouter } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { rateLimit } from "./middlewares/rate-limit";

const BODY_LIMIT = "48kb";

export function createHttpApp(router: IRouter): Express {
  const app = express();

  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
  if (Number.isInteger(trustProxyHops) && trustProxyHops >= 0) {
    app.set("trust proxy", trustProxyHops);
  }

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );
  app.use(cors());
  // Run a coarse limiter before JSON parsing so malformed/large-body floods
  // cannot bypass all accounting.
  app.use("/api", rateLimit({ windowMs: 60_000, max: 300 }));
  app.use(express.json({ limit: BODY_LIMIT, strict: true }));
  app.use("/api", router);

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const bodyError = err as { status?: number; type?: string };
    if (bodyError.type === "entity.too.large" || bodyError.status === 413) {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
    if (bodyError.type === "entity.parse.failed" || bodyError.status === 400) {
      res.status(400).json({ error: "Malformed JSON" });
      return;
    }
    req.log.error({ err }, "Unhandled request error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}