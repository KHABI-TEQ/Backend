import { Request, Response, NextFunction } from 'express';
import { RouteError } from '../common/classes';

export function use(handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req, res, next);
      if (!res.headersSent) {
        res.status(200).json(result);
      }
    } catch (error: any) {
      if (error instanceof RouteError) {
        return res.status(error.status).json({
          error: error.message,
          ...(error.message2 && { details: error.message2 }),
        });
      }

      console.error('[UNHANDLED ERROR]', error);
      return res.status(500).json({ error: 'Unexpected server error' });
    }
  };
}
