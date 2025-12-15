# WhatsApp Cloud API Integration Guide

## Overview

This integration connects WhatsApp Cloud API with your LiveMargs application. Each WhatsApp conversation becomes a LiveKit room, allowing seamless integration with your existing chat infrastructure.

## Features

- ✅ Receive WhatsApp messages (text, images, videos, audio, documents)
- ✅ Send WhatsApp messages with media support
- ✅ Automatic LiveKit room creation per phone number
- ✅ Message persistence in PostgreSQL and MongoDB
- ✅ Message status tracking (sent, delivered, read)
- ✅ Media file downloads and storage
- ✅ Webhook verification and event handling

## Setup

### 1. WhatsApp Business Account Setup

1. Create a Meta Business account at [business.facebook.com](https://business.facebook.com)
2. Set up WhatsApp Business Platform
3. Get your credentials:
   - Phone Number ID
   - Business Account ID
   - Access Token

### 2. Environment Configuration

Update your `.env` file with the following variables:

```env
# WhatsApp Cloud API Configuration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token_here
WHATSAPP_API_VERSION=v21.0
```

**Important Notes:**
- `WHATSAPP_ACCESS_TOKEN`: Your permanent access token from Meta
- `WHATSAPP_PHONE_NUMBER_ID`: The phone number ID (not the actual phone number)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: A random string you create (used for webhook verification)

### 3. Webhook Configuration

Configure your webhook in the Meta Developer Console:

1. **Webhook URL**: `https://your-domain.com/whatsapp/webhook`
2. **Verify Token**: Use the same token from `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
3. **Subscribe to fields**:
   - messages
   - message_status

### 4. Database Setup

The integration automatically creates the necessary database tables:

#### PostgreSQL
- `whatsapp_messages` table with indexes on phone_number, room_name, and whatsapp_message_id

#### MongoDB
- `whatsappMessages` collection with TTL index and compound indexes

No manual setup required - tables/collections are created automatically on first connection.

## API Endpoints

### 1. Webhook Verification (GET)
```
GET /whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
```
Used by WhatsApp to verify your webhook during setup.

### 2. Webhook Events (POST)
```
POST /whatsapp/webhook
```
Receives incoming messages and status updates from WhatsApp.

### 3. Send Message
```
POST /whatsapp/send
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "text": "Hello from LiveMargs!",
  "mediaUrl": "https://example.com/image.jpg",  // Optional
  "mediaType": "image",                          // Optional: text, image, video, audio, document
  "fileName": "photo.jpg",                       // Optional
  "caption": "Check this out!"                   // Optional
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "internal_message_id",
  "whatsappMessageId": "wamid.xxx",
  "roomName": "whatsapp_1234567890"
}
```

### 4. Get Messages
```
GET /whatsapp/messages/:phoneNumber
```

**Response:**
```json
[
  {
    "messageId": "abc123",
    "whatsappMessageId": "wamid.xxx",
    "phoneNumber": "+1234567890",
    "roomName": "whatsapp_1234567890",
    "text": "Hello!",
    "direction": "incoming",
    "status": "delivered",
    "timestamp": 1702656000000
  }
]
```

## How It Works

### Incoming Messages Flow

1. User sends WhatsApp message
2. WhatsApp sends webhook event to `/whatsapp/webhook`
3. System processes message:
   - Downloads media files (if any)
   - Gets or creates LiveKit room for phone number
   - Saves to `whatsapp_messages` table/collection
   - Saves to `chat_messages` (LiveKit room messages)
4. Message is available in both WhatsApp and LiveKit contexts

### Outgoing Messages Flow

1. Client calls `POST /whatsapp/send`
2. System sends message via WhatsApp API
3. Saves message with "sent" status
4. WhatsApp webhook updates status (delivered, read)
5. Message appears in LiveKit room

### LiveKit Room Integration

Each WhatsApp phone number gets its own LiveKit room:
- Room name format: `whatsapp_{phone_number}`
- Room title: `WhatsApp: {phone_number}`
- Channel: Customer
- Department: Customer Service
- Private room: true

This allows:
- Viewing WhatsApp chats in your existing LiveKit interface
- Integrating with AI services
- Tracking conversation history
- Managing multiple customer conversations

## Media Handling

### Supported Media Types

- **Images**: JPEG, PNG, GIF, WebP (max 5MB)
- **Videos**: MP4, 3GP (max 16MB)
- **Audio**: AAC, M4A, MP3, AMR, OGG (max 16MB)
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX (max 100MB)

### Media Storage

1. Media is downloaded from WhatsApp servers
2. Stored in `uploads/whatsapp/` directory
3. Accessible via `/uploads/whatsapp/{filename}`
4. Reference stored in database with message

## Message Status Tracking

Messages go through several status updates:

1. **Pending**: Initial state (before sending)
2. **Sent**: Message sent to WhatsApp
3. **Delivered**: Delivered to recipient's phone
4. **Read**: Recipient opened the message
5. **Failed**: Message failed to send

Status updates are received via webhook and stored in the database.

## Database Schema

### WhatsApp Messages Table/Collection

```typescript
{
  messageId: string;           // Internal ID
  whatsappMessageId: string;   // WhatsApp's message ID
  phoneNumber: string;         // Customer's phone
  roomName: string;            // Associated LiveKit room
  text?: string;               // Message text
  mediaUrl?: string;           // Local media URL
  mediaType?: string;          // image, video, audio, document
  fileName?: string;           // Original filename
  fileSize?: number;           // File size in bytes
  mimeType?: string;           // MIME type
  caption?: string;            // Media caption
  direction: string;           // incoming | outgoing
  status: string;              // sent | delivered | read | failed
  timestamp: number;           // Message timestamp
  deliveredAt?: number;        // Delivery timestamp
  readAt?: number;             // Read timestamp
  failedReason?: string;       // Error message if failed
  expiresAt: Date;             // TTL (5 years)
}
```

## Error Handling

All errors are logged but don't break the webhook flow (to avoid WhatsApp retries).

Common errors:
- Invalid access token → Check `WHATSAPP_ACCESS_TOKEN`
- Media download failed → Check network/permissions
- Database errors → Check database connection

## Testing

### 1. Verify Webhook

Test webhook verification:
```bash
curl "https://your-domain.com/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

Expected response: `test123`

### 2. Send Test Message

```bash
curl -X POST https://your-domain.com/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "text": "Test message from API"
  }'
```

### 3. Check Messages

```bash
curl https://your-domain.com/whatsapp/messages/+1234567890
```

## Best Practices

1. **Phone Number Format**: Always use E.164 format (+1234567890)
2. **Media URLs**: Ensure media URLs are publicly accessible
3. **Rate Limits**: WhatsApp has rate limits (1000 messages/day for new accounts)
4. **Message Templates**: Use templates for initial outbound messages (WhatsApp requirement)
5. **24-hour Window**: Free-form messages only within 24 hours of last customer message

## Security

- Webhook verification prevents unauthorized access
- Access token should be kept secure
- Use HTTPS for all webhook endpoints
- Validate all incoming data

## Troubleshooting

### Messages not received
1. Check webhook is correctly configured in Meta console
2. Verify `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches
3. Check server logs for errors
4. Ensure HTTPS is working

### Cannot send messages
1. Verify `WHATSAPP_ACCESS_TOKEN` is valid
2. Check `WHATSAPP_PHONE_NUMBER_ID` is correct
3. Ensure recipient has opted in (for new conversations)
4. Check message is within 24-hour window or using approved template

### Media not downloading
1. Check network connectivity
2. Verify upload directory permissions
3. Check disk space
4. Verify access token has media permissions

## Support

For WhatsApp API issues, refer to:
- [WhatsApp Business Platform Documentation](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api)

## Future Enhancements

Potential improvements:
- [ ] Support for WhatsApp templates
- [ ] Message reactions
- [ ] Reply to specific messages
- [ ] Group chat support
- [ ] Interactive messages (buttons, lists)
- [ ] WhatsApp Business profile management
- [ ] Analytics and reporting
