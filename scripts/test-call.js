require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const NGROK_URL = process.env.NGROK_URL || 'https://your-ngrok-url.ngrok-free.app';
const TWILIO_NUMBER = process.env.TWILIO_NUMBER || '+10000000000';
const TEST_PHONE = process.env.TEST_PHONE || '+00000000000';

const webhookUrl = NGROK_URL.replace('wss://', 'https://') + '/voice';

console.log('Initiating test call...');
console.log('From:', TWILIO_NUMBER);
console.log('To:', TEST_PHONE);
console.log('Webhook:', webhookUrl);
console.log('');

client.calls
  .create({
    to: TEST_PHONE,
    from: TWILIO_NUMBER,
    url: webhookUrl,
  })
  .then((call) => {
    console.log('✓ Call initiated successfully');
    console.log('Call SID:', call.sid);
    console.log('Status:', call.status);
    console.log('');
    console.log('Next steps:');
    console.log('1. Answer the phone');
    console.log('2. Watch the server logs for WebSocket events');
    console.log('3. Speak into the phone to generate audio chunks');
    console.log('');
    console.log('Monitor health: curl http://localhost:3000/health');
  })
  .catch((err) => {
    console.error('✗ Failed to initiate call');
    console.error('Error:', err.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('- Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
    console.error('- Ensure phone numbers are in E.164 format (+1234567890)');
    console.error('- Check Twilio account balance');
  });
