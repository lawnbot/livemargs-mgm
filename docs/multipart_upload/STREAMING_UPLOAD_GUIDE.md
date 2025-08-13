# File Upload System Implementation

## Overview
This implementation provides efficient handling of large files through multiple upload methods for different use cases:

### 1. Room File Upload (`/uploadRoomFiles/:room`)
- Uses `multer.diskStorage()` for direct file writing
- Best for: Small to medium files (< 100MB)
- Memory usage: Low (files written directly to disk)
- Storage location: `UPLOAD_DIR/rooms/{room}/`

### 2. Room File Stream Upload (`/uploadRoomFilesStream/:room`)
- Uses `multer.memoryStorage()` with custom streaming
- Best for: Large files (> 100MB)
- Memory usage: Controlled (files processed in memory then streamed to disk)
- Storage location: `UPLOAD_DIR/rooms/{room}/`

### 3. RAG Collection Upload (`/uploadRagFiles/:collection`)
- Uses `multer.diskStorage()` for RAG document processing
- Always requires authentication
- Storage location: `UPLOAD_DIR/rag/{collection}/`

## Key Features

### Efficient Memory Management
- Memory storage temporarily holds files in buffer
- Immediate streaming to disk prevents memory overflow
- Progress tracking for large file uploads

### Error Handling
- Partial file cleanup on upload failure
- Comprehensive error reporting
- TypeScript-safe error handling

### File Safety
- Room name sanitization (alphanumeric, underscore, hyphen only)
- Collection name sanitization for RAG uploads
- Unique filename generation with crypto hashes
- Directory traversal protection
- Organized storage in dedicated subfolders (`rooms/`, `rag/`)

### Authentication & Authorization
- Room uploads: Conditional auth based on room type (Internal rooms require auth)
- RAG uploads: Always require authentication
- Token-based authorization using JWT

### File Management
- List files in rooms (excluding thumbnail directories)
- Download files from rooms with security validation
- Automatic directory creation for rooms and collections

## API Endpoints

### Room File Upload (Standard)
```
POST /uploadRoomFiles/:room
Content-Type: multipart/form-data
Authentication: Conditional (required for Internal rooms)
```

### Room File Upload (Streaming)
```
POST /uploadRoomFilesStream/:room
Content-Type: multipart/form-data
Authentication: Conditional (required for Internal rooms)
```

### RAG Collection Upload
```
POST /uploadRagFiles/:collection
Content-Type: multipart/form-data
Authentication: Required (JWT token)
```

### List Files in Room
```
GET /listRoomFiles/:room
Authentication: Conditional (required for Internal rooms)
```

### Download File from Room
```
GET /downloadFile/:room/:filename
Authentication: Conditional (required for Internal rooms)
```

All upload endpoints accept:
- `:room` - Sanitized room name (alphanumeric, underscore, hyphen only)
- `:collection` - Sanitized collection name for RAG uploads
- `:filename` - Filename for download endpoint
- Form field: `files` (multiple files supported)

## Storage Structure

```
UPLOAD_DIR/
├── rooms/
│   ├── room1/
│   │   ├── file1.abc123.pdf
│   │   └── file2.def456.jpg
│   └── room2/
│       └── document.ghi789.docx
└── rag/
    ├── collection1/
    │   ├── doc1.jkl012.txt
    │   └── doc2.mno345.pdf
    └── collection2/
        └── research.pqr678.md
```

## Configuration

```typescript
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300 MB per file
const MAX_FILES = 20; // Maximum files per request
```

## Advanced Features

### Stream Processing Functions
- `streamFileToRoom()` - Buffer-based file writing
- `streamLargeFileToRoom()` - True streaming with progress tracking

### Middleware Pipeline

#### Room Uploads
1. `checkUploadRequiresAuth` - Conditional authentication
2. `preSanitizeCheck` - Room name validation
3. `upload.array('files')` or `uploadStream.array('files')` - Multer processing
4. `uploadForRoom` / `uploadForRoomStream` - Response handling

#### RAG Uploads
1. `authenticateTokenMiddleWare` - Required JWT authentication
2. `preSanitizeCheckCollection` - Collection name validation
3. `uploadRag.array('files')` - RAG-specific Multer processing
4. `uploadForRagCollection` - RAG response handling

#### File Operations
1. `checkUploadRequiresAuth` - Conditional authentication
2. `preSanitizeCheck` - Room name validation
3. `listFilesForRoom` / `downloadFileFromRoom` - File operations

## Usage Recommendations

### File Upload Strategy
- Use standard room upload for files < 100MB
- Use stream room upload for files > 100MB  
- Use RAG upload for documents intended for AI processing
- Monitor memory usage in production
- Configure appropriate file size limits based on server capacity

### Security Best Practices
- Always validate room/collection names
- Use JWT tokens for sensitive uploads (RAG, Internal rooms)
- Implement rate limiting for upload endpoints
- Monitor storage usage and implement cleanup strategies

### File Organization
- Room files: Use descriptive room names for easy organization
- RAG collections: Group related documents by collection name
- Regular cleanup: Remove unused files to manage storage

## Error Response Format
```json
{
  "error": "Description of the error"
}
```

## Success Response Formats

### Upload Response
```json
{
  "room": "room_name",
  "uploaded": 2,
  "files": [
    {
      "field": "files",
      "originalName": "document.pdf",
      "storedName": "document.abc123.pdf",
      "size": 1048576,
      "mimeType": "application/pdf",
      "relativePath": "rooms/room_name/document.abc123.pdf"
    }
  ]
}
```

### RAG Upload Response
```json
{
  "collection": "research_docs",
  "uploaded": 1,
  "files": [
    {
      "field": "files",
      "originalName": "research.pdf",
      "storedName": "research.def456.pdf",
      "size": 2097152,
      "mimeType": "application/pdf",
      "relativePath": "rag/research_docs/research.def456.pdf"
    }
  ]
}
```

### List Files Response
```json
{
  "room": "room_name",
  "fileCount": 2,
  "files": [
    {
      "name": "document.abc123.pdf",
      "size": 1048576,
      "lastModified": "2025-08-13T10:30:00.000Z",
      "relativePath": "rooms/room_name/document.abc123.pdf"
    }
  ]
}
```
