const crypto = require('crypto');
const https = require('https');

function createOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

async function sendOtp(phone, otp, purpose) {
  const smsProvider = process.env.SMS_PROVIDER || (process.env.SMS_ENABLED === 'true' ? 'twilio' : 'console');

  console.log(`[OTP:${purpose}] Mobile: ${phone} | Code: ${otp}`);

  // 1. Fast2SMS (Indian Mobile SMS Provider)
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const apiKey = process.env.FAST2SMS_API_KEY;
      const cleanNumber = phone.replace(/\D/g, '').slice(-10);

      const postData = JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: cleanNumber
      });

      const options = {
        hostname: 'www.fast2sms.com',
        path: '/dev/bulkV2',
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            console.log(`[Fast2SMS Sent] ${data}`);
            resolve(data);
          });
        });
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
      });
      return;
    } catch (err) {
      console.error(`[Fast2SMS Error] ${err.message}`);
    }
  }

  // 2. Twilio (Global SMS Provider)
  if (smsProvider === 'twilio' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Your CropCare ${purpose} verification OTP is ${otp}. Expires in 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      });
      console.log(`[Twilio SMS Sent] Delivered OTP to ${phone}`);
      return;
    } catch (err) {
      console.error(`[Twilio Error] ${err.message}`);
    }
  }
}

module.exports = { createOtp, hashOtp, sendOtp };
