// declare module 'jsonwebtoken';
// declare module 'nodemailer';
// declare module 'passport';
// declare module 'bcryptjs';
// declare module 'morgan';
// declare module 'cookie-parser';
// declare module 'cors';
// declare module 'passport-jwt';

// // Fix for the req.user issue
declare namespace Express {
  export interface Request {
    user?: any;
  }
}
