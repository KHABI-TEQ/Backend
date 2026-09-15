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
const server = app.listen(port, "0.0.0.0", () => {
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const clipFlag = String(process.env.PROPERTY_IMAGE_CLIP_ENABLED ?? "").trim() || "(unset)";
  console.log("express server 🚀 started on port: " + port);
  console.log(`API reachable at http://127.0.0.1:${port}/api`);
  console.log(
    `[memory] rss=${rssMb}MB CLIP_ENABLED=${clipFlag}${process.env.RENDER ? " RENDER=1" : ""}`,
  );
  console.log(
    isFirebaseReady()
      ? '[Firebase] Push notifications ready (FCM Admin).'
      : '[Firebase] Push not configured — set FIREBASE_* env vars to enable.'
  );
});

export default server;
