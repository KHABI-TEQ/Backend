import { Request } from "express";

export interface AppRequest<
  P = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: any;
  users?: any;
  admin?: any;
}
