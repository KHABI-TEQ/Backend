import morgan from 'morgan';
import helmet from 'helmet';
import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

import BaseRouter from './routes';
import { RouteError } from './common/classes';
import cors from 'cors';
// import CronJob from './common/cron.job';
import KeepAlive from './services/cron-job';
import path from 'path';


// Init express
const app = express();

/************************************************************************************
 *                              Set basic express settings
 ***********************************************************************************/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors());

// app.use(cors({
//   origin: '*',
//   credentials: true, 
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
// }));

// Show routes called in console during development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Security
if (process.env.NODE_ENV === 'production') {
  app.use(helmet());
}

app.use(express.static('public'));

// CronJob();
KeepAlive();

// Add APIs

app.use('/api', BaseRouter);

app.get('/', (req: Request, res: Response) => {
  return res.sendFile('welcome.html', { root: path.join(__dirname, '../public') });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error Handler:', err);
  if (err instanceof RouteError) {
    return res.status(err.status).json({
      error: err.message,
      details: err.message2 || null, // Include `message2` if available
    });
  }

  // Fallback for other error types
  // console.error('Unexpected Error:', err);
  res.status(500).json({
    error:err.message,
    message: err.message,
  });
});
// Export express instance
export default app;
