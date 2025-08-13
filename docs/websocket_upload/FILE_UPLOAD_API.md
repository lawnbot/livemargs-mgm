Idee aufgegeben, da nicht empfohlen für große Dateien!
Viele Chunk-Messages sind pro Upload notwendig, die zur Überlastung führen können.

# WebSocket File Upload API

Diese Dokumentation beschreibt die WebSocket-basierte Datei-Upload-Funktionalität, die in chunks arbeitet und Dateien in einem lokalen Ordner speichert.

## Konfiguration

### Environment-Variablen

```bash
UPLOAD_DIR=./uploads                # Standardordner für Uploads
MAX_FILE_SIZE=10485760             # Maximale Dateigröße in Bytes (10MB Standard)
CHUNK_SIZE=64000                   # Chunk-Größe in Bytes (64KB Standard)
```

## WebSocket-Endpoints

### 1. Start File Upload

Startet eine neue Datei-Upload-Session.

**Command:** `start-file-upload`

**Request:**
```json
{
  "command": "start-file-upload",
  "user": {
    "email": "user@example.com",
    "mgmAccessToken": "..."
  },
  "messageData": {
    "fileName": "document.pdf",
    "fileSize": 1048576,
    "roomName": "optional_room_id"
  }
}
```

**Response (Success):**
```json
{
  "fbStatus": "Okay",
  "originalCommand": "start-file-upload",
  "fbCommand": "fb-start-file-upload",
  "fbMessage": "File upload session started.",
  "fbData": "{\"uploadId\":\"abc123def456\",\"chunkSize\":64000}"
}
```

**Response (Error):**
```json
{
  "fbStatus": "Error",
  "originalCommand": "start-file-upload",
  "fbCommand": "fb-start-file-upload",
  "fbMessage": "File size exceeds maximum allowed size of 10485760 bytes."
}
```

### 2. Upload File Chunk

Lädt einen einzelnen Daten-Chunk hoch.

**Command:** `upload-file-chunk`

**Request:**
```json
{
  "command": "upload-file-chunk",
  "user": {
    "email": "user@example.com",
    "mgmAccessToken": "..."
  },
  "messageData": {
    "uploadId": "abc123def456",
    "chunkIndex": 0,
    "chunkData": "base64_encoded_chunk_data",
    "isLastChunk": false
  }
}
```

**Response (Progress):**
```json
{
  "fbStatus": "Okay",
  "originalCommand": "upload-file-chunk",
  "fbCommand": "fb-upload-file-chunk",
  "fbMessage": "Chunk 0 received.",
  "fbData": "{\"uploadId\":\"abc123def456\",\"chunkIndex\":0,\"progress\":25,\"receivedSize\":262144,\"totalSize\":1048576}"
}
```

**Response (Complete):**
```json
{
  "fbStatus": "Okay",
  "originalCommand": "upload-file-chunk",
  "fbCommand": "fb-file-upload-complete",
  "fbMessage": "File uploaded successfully.",
  "fbData": "{\"uploadId\":\"abc123def456\",\"fileName\":\"document.pdf\",\"filePath\":\"2025-08-12T10-30-45-123Z_user@example.com_document.pdf\",\"fileSize\":1048576,\"uploadDurationMs\":5234,\"roomName\":\"room123\"}"
}
```

### 3. Cancel File Upload

Bricht eine laufende Upload-Session ab.

**Command:** `cancel-file-upload`

**Request:**
```json
{
  "command": "cancel-file-upload",
  "user": {
    "email": "user@example.com",
    "mgmAccessToken": "..."
  },
  "messageData": {
    "uploadId": "abc123def456"
  }
}
```

**Response:**
```json
{
  "fbStatus": "Okay",
  "originalCommand": "cancel-file-upload",
  "fbCommand": "fb-cancel-file-upload",
  "fbMessage": "File upload cancelled."
}
```

## Client-Implementierung

### JavaScript-Beispiel

```javascript
class FileUploader {
  constructor(websocket) {
    this.ws = websocket;
    this.chunkSize = 64000;
  }

  async uploadFile(file, roomName = null) {
    try {
      // 1. Start upload session
      const startRequest = {
        command: "start-file-upload",
        user: this.user,
        messageData: {
          fileName: file.name,
          fileSize: file.size,
          roomName: roomName
        }
      };
      
      this.ws.send(JSON.stringify(startRequest));
      
      // Warte auf Upload-ID Response
      const response = await this.waitForResponse("fb-start-file-upload");
      const { uploadId, chunkSize } = JSON.parse(response.fbData);
      this.chunkSize = chunkSize;

      // 2. Upload chunks
      const totalChunks = Math.ceil(file.size / this.chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        const chunkData = await this.arrayBufferToBase64(await chunk.arrayBuffer());
        const isLastChunk = i === totalChunks - 1;
        
        const chunkRequest = {
          command: "upload-file-chunk",
          user: this.user,
          messageData: {
            uploadId: uploadId,
            chunkIndex: i,
            chunkData: chunkData,
            isLastChunk: isLastChunk
          }
        };
        
        this.ws.send(JSON.stringify(chunkRequest));
        
        // Warte auf Chunk-Bestätigung
        await this.waitForResponse("fb-upload-file-chunk");
      }
      
      // 3. Warte auf Completion
      const completion = await this.waitForResponse("fb-file-upload-complete");
      return JSON.parse(completion.fbData);
      
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  }
  
  arrayBufferToBase64(buffer) {
    return new Promise((resolve) => {
      const blob = new Blob([buffer]);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }
  
  waitForResponse(fbCommand) {
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        const response = JSON.parse(event.data);
        if (response.fbCommand === fbCommand) {
          this.ws.removeEventListener('message', handler);
          if (response.fbStatus === "Okay") {
            resolve(response);
          } else {
            reject(new Error(response.fbMessage));
          }
        }
      };
      this.ws.addEventListener('message', handler);
    });
  }
}

// Verwendung
const uploader = new FileUploader(websocket);
uploader.uploadFile(file, "room123")
  .then(result => console.log("Upload successful:", result))
  .catch(error => console.error("Upload failed:", error));
```

## Sicherheitsaspekte

1. **Dateiname-Sanitization:** Alle Dateinamen werden automatisch bereinigt, um Pfad-Traversal-Angriffe zu verhindern.

2. **Größenlimits:** Dateien werden auf die konfigurierte maximale Größe begrenzt.

3. **Eindeutige Dateinamen:** Dateien werden mit Timestamp und Benutzer-ID versehen, um Kollisionen zu vermeiden.

4. **Automatisches Cleanup:** Unvollständige Uploads werden bei Verbindungsabbruch automatisch bereinigt.

## Dateiorganisation

Dateien werden im folgenden Format gespeichert:
```
uploads/
├── 2025-08-12T10-30-45-123Z_user@example.com_document.pdf
├── 2025-08-12T10-31-22-456Z_admin@company.com_image.jpg
└── ...
```

Format: `{timestamp}_{userId}_{originalFileName}`

## Fehlerbehandlung

- **Upload-Session nicht gefunden:** Tritt auf, wenn eine ungültige uploadId verwendet wird
- **Datei zu groß:** Dateien über dem konfigurierten Limit werden abgelehnt
- **Chunk-Verarbeitungsfehler:** Ungültige Base64-Daten oder andere Dekodierungsfehler
- **Speicherfehler:** Probleme beim Schreiben auf die Festplatte
- **Verbindungsabbruch:** Unvollständige Uploads werden automatisch bereinigt
