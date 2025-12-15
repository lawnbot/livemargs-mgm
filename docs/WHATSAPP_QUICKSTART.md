# WhatsApp Integration - Quick Reference

## Quick Start

1. **Add credentials to .env:**
```env
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=create_random_string
```

2. **Configure webhook in Meta:**
- URL: `https://your-domain.com/whatsapp/webhook`
- Token: Same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Subscribe to: messages, message_status

3. **Build and restart:**
```bash
npm run build
npm start
```

## API Examples

### Send Text Message
```javascript
fetch('https://your-domain.com/whatsapp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+1234567890',
    text: 'Hello from LiveMargs!'
  })
});
```

### Send Image with Caption
```javascript
fetch('https://your-domain.com/whatsapp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+1234567890',
    mediaUrl: 'https://example.com/image.jpg',
    mediaType: 'image',
    caption: 'Check this out!'
  })
});
```

### Send Document
```javascript
fetch('https://your-domain.com/whatsapp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+1234567890',
    mediaUrl: 'https://example.com/document.pdf',
    mediaType: 'document',
    fileName: 'invoice.pdf',
    caption: 'Your invoice'
  })
});
```

### Get All Messages for a Number
```javascript
fetch('https://your-domain.com/whatsapp/messages/+1234567890')
  .then(res => res.json())
  .then(messages => console.log(messages));
```

## File Structure

```
src/
├── models/
│   └── whatsapp-message.ts       # WhatsApp message types and interfaces
├── controllers/
│   └── whatsapp.ts                # WhatsApp business logic
├── routes/
│   └── whatsapp-routes.ts         # API endpoints
└── db/
    ├── postgres-db-service.ts     # PostgreSQL implementation
    └── mongo-db-service.ts        # MongoDB implementation
```

## Database Methods

### Save Message
```typescript
await dbService.saveWhatsAppMessage(message);
```

### Get Messages by Phone
```typescript
const messages = await dbService.getWhatsAppMessagesByPhoneNumber('+1234567890');
```

### Update Status
```typescript
await dbService.updateWhatsAppMessageStatus('wamid.xxx', {
  status: MessageStatus.Read,
  readAt: Date.now()
});
```

## Media Types

| Type | Extensions | Max Size |
|------|-----------|----------|
| image | jpg, png, gif, webp | 5MB |
| video | mp4, 3gp | 16MB |
| audio | aac, m4a, mp3, amr, ogg | 16MB |
| document | pdf, doc, docx, xls, xlsx, ppt, pptx | 100MB |

## Room Mapping

| WhatsApp Phone | LiveKit Room |
|----------------|--------------|
| +1234567890 | whatsapp_1234567890 |
| +49301234567 | whatsapp_49301234567 |

## Status Flow

```
Outgoing: pending → sent → delivered → read
                          ↓
                        failed
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Webhook not working | Check HTTPS, verify token match |
| Cannot send messages | Verify access token and phone number ID |
| Media not downloading | Check network and file permissions |
| Messages not in DB | Check database connection and logs |

## Logs Location

Check these logs for debugging:
- Server logs: `logs/` directory
- Console output: `npm start` or `pm2 logs`
- Database errors: Check respective DB service logs

## Webhook Payload Example

Incoming message:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "1234567890",
          "id": "wamid.xxx",
          "timestamp": "1702656000",
          "type": "text",
          "text": { "body": "Hello!" }
        }]
      }
    }]
  }]
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| WHATSAPP_ACCESS_TOKEN | Yes | - | Meta access token |
| WHATSAPP_PHONE_NUMBER_ID | Yes | - | Phone number ID from Meta |
| WHATSAPP_WEBHOOK_VERIFY_TOKEN | Yes | - | Your custom verify token |
| WHATSAPP_API_VERSION | No | v21.0 | WhatsApp API version |

## Testing Checklist

- [ ] Webhook verified in Meta console
- [ ] Can receive text messages
- [ ] Can receive images
- [ ] Can send text messages
- [ ] Can send images
- [ ] Messages saved in database
- [ ] LiveKit rooms created
- [ ] Status updates working
- [ ] Media downloads working

## Support Links

- [WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta Business Help](https://business.facebook.com/business/help)
- [API Explorer](https://developers.facebook.com/tools/explorer/)
