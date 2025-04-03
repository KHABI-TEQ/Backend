// import axios from 'axios';
// import { NextApiRequest, NextApiResponse } from 'next';
import { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library/build/src';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const googleAuthHandler = async (req: Request, res: Response, next: NextFunction) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: 'Authorization code is required' });
  }

  try {
    console.log('Code:', code);
    const tokenResponse = await client.getToken(code);
    console.log('Token Response:', tokenResponse);

    const tokens = tokenResponse.tokens; // Includes `access_token`, `id_token`, etc.
    // console.log('Token Response:', tokens);

    // Optionally verify the ID token here if needed.
    req.body = {
      idToken: tokens.id_token,
    };
    next();
  } catch (error) {
    console.log('Error exchanging code for tokens:', error.response?.data || error);
    res.status(500).json({
      message: 'Failed to exchange authorization code for tokens',
    });
  }
};

export default googleAuthHandler;
