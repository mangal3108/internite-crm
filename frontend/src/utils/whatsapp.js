import { commsAPI } from '../services/api'

/** Send a WhatsApp text message */
export async function sendWhatsApp(number, message) {
  const clean = String(number).replace(/\D/g, '')
  if (!clean) throw new Error('Invalid phone number')
  return commsAPI.sendChannel({
    channel: 'whatsapp',
    recipient: clean,
    body: message,
  })
}
