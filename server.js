const express = require("express")
const twilio = require("twilio")

const app = express()

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

const VoiceResponse = twilio.twiml.VoiceResponse

app.post("/voice", (req, res) => {
  const twiml = new VoiceResponse()

  twiml.say(
    { voice: "alice" },
    "Hello Nirmit. Your AI phone agent is now running."
  )

  res.type("text/xml")
  res.send(twiml.toString())
})

app.get("/", (req, res) => {
  res.send("Server running")
})

app.listen(3000, () => {
  console.log("Server running on port 3000")
})