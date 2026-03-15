require("dotenv").config()
const twilio = require("twilio")

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

const TWILIO_NUMBER = process.env.TWILIO_NUMBER
const TEST_PHONE = process.env.TEST_PHONE
const NGROK_URL = process.env.NGROK_URL

client.calls
  .create({
    to: TEST_PHONE,
    from: TWILIO_NUMBER,
    url: NGROK_URL.replace("wss://", "https://") + "/voice",
  })
  .then(call => console.log("Call SID:", call.sid))
  .catch(err => console.error(err))