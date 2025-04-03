// import './LoadEnv'; // Must be the first import
import app from './server';
import dotenv from 'dotenv';

dotenv.config();
// Start the server
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log('express server 🚀 started on port: ' + port);
});

export default server;
