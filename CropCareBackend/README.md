# CropCare Backend

Express + MongoDB authentication API with password login, phone verification, and mobile OTP login.

## Requirements

- Node.js 20 or newer
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Update `.env` with a long `JWT_SECRET` and your MongoDB connection string. Start the API with:

```powershell
npm run dev
```

The API runs at `http://localhost:5000` by default. The health check is `GET /health`.

## Auth endpoints

- `POST /api/auth/signup` with `{ "name", "phone", "password" }`
- `POST /api/auth/verify-phone` with `{ "phone", "otp" }`
- `POST /api/auth/login` with `{ "phone", "password" }`
- `POST /api/auth/request-login-otp` with `{ "phone" }`
- `POST /api/auth/login-with-otp` with `{ "phone", "otp" }`

In development, OTP values are printed to the server console. For production, add Twilio credentials to `.env`, set `SMS_ENABLED=true`, and keep provider credentials in environment variables. OTPs are stored hashed, expire after five minutes by default, and are limited to five verification attempts.
