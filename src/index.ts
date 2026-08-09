// import './LoadEnv'; // Must be the first import
import app from './server';
import dotenv from 'dotenv';
import { runWhatsAppBootValidation } from './services/whatsAppBootValidation.service';
import {
  ensureFirebaseAdmin,
  isFirebaseReady,
} from './services/firebaseAdmin.service';

dotenv.config();
runWhatsAppBootValidation();
ensureFirebaseAdmin();
// Start the server
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log('express server 🚀 started on port: ' + port);
  console.log(
    isFirebaseReady()
      ? '[Firebase] Push notifications ready (FCM Admin).'
      : '[Firebase] Push not configured — set FIREBASE_* env vars to enable.'
  );
});

export default server;
