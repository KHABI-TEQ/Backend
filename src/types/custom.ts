import { Request } from 'express';
import { IAdminDoc } from '../models/admin';

export interface AdminRequest extends Request {
  admin?: IAdminDoc;
}
