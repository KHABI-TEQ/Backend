import dotenv from 'dotenv';

// Set the env file
const result = dotenv.config();

if (result.error) {
  throw result.error;
}
