Idee aufgegeben, da nicht empfohlen für große Dateien!
Viele Chunk-Messages sind pro Upload notwendig, die zur Überlastung führen können.

# WebSocket File Upload Feature

## Übersicht

Diese Implementierung erweitert die bestehende WebSocket-API um eine robuste Datei-Upload-Funktionalität, die Dateien in chunks verarbeitet und lokal speichert.

## Neue Features

### ✅ Chunk-basierter Upload
- Dateien werden in konfigurierbaren Chunks (Standard: 64KB) hochgeladen
- Ermöglicht Upload von großen Dateien ohne Speicher-Overflow
- Fortschritts-Tracking für jeden Chunk

### ✅ Robuste Fehlerbehandlung
- Validierung von Dateigrößen und -namen
- Automatisches Cleanup bei Verbindungsabbruch
- Retry-Mechanismus durch Client implementierbar

### ✅ Sicherheitsfeatures
- Dateiname-Sanitization gegen Path-Traversal
- Konfigurierbare Größenlimits
- Eindeutige Dateinamen mit Timestamp und User-ID

### ✅ Integration in bestehende Architektur
- Nutzt vorhandene WebSocket-Infrastruktur
- Kompatibel mit bestehenden WSFeedback-Mustern
- Optional: Speicherung von Upload-Nachrichten in MongoDB für Räume

## Neue WebSocket Commands

1. **`start-file-upload`** - Startet Upload-Session
2. **`upload-file-chunk`** - Lädt einzelnen Chunk hoch
3. **`cancel-file-upload`** - Bricht Upload ab

## Konfiguration

Neue Environment-Variablen:
```bash
UPLOAD_DIR=./uploads           # Upload-Verzeichnis
MAX_FILE_SIZE=10485760        # Max. Dateigröße (10MB)
CHUNK_SIZE=64000              # Chunk-Größe (64KB)
```

## Dateien

### Implementierung
- `src/server.ts` - Hauptimplementierung mit WebSocket-Handlers
- `FILE_UPLOAD_API.md` - Detaillierte API-Dokumentation
- `file-upload-test.html` - Test-Client für Browser

### Dateistruktur nach Upload
```
uploads/
├── 2025-08-12T10-30-45-123Z_user@example.com_document.pdf
├── 2025-08-12T10-31-22-456Z_admin@company.com_image.jpg
└── ...
```

## Testing

1. **Server starten:**
   ```bash
   npm run build
   npm start
   ```

2. **Test-Client öffnen:**
   - Öffne `file-upload-test.html` im Browser
   - Verbinde zu `ws://localhost:3000/ws`
   - Wähle eine Datei und starte den Upload

3. **Manueller Test:**
   - Siehe `FILE_UPLOAD_API.md` für detaillierte WebSocket-Nachrichten

## Monitoring

Upload-Aktivitäten werden in der Konsole geloggt:
```
File uploaded successfully: ./uploads/2025-08-12T10-30-45-123Z_user@example.com_test.pdf (1048576 bytes in 2134ms)
```

## Performance

- **Speichereffizienz:** Chunks werden einzeln verarbeitet, nicht die gesamte Datei
- **Netzwerk:** Configurable Chunk-Größe für optimale Übertragung
- **Cleanup:** Automatische Bereinigung bei Verbindungsabbruch

## Sicherheit

- ✅ Dateiname-Sanitization
- ✅ Größenlimits
- ✅ Eindeutige Dateinamen
- ✅ Keine Code-Execution (nur Datenspeicherung)
- ⚠️ **TODO:** Dateitype-Validierung
- ⚠️ **TODO:** Virus-Scanning
- ⚠️ **TODO:** Rate-Limiting pro User

## Erweiterungsmöglichkeiten

1. **Dateitype-Filtering:** Nur bestimmte Dateitypen erlauben
2. **Thumbnails:** Automatische Generierung für Bilder
3. **Cloud-Storage:** Integration mit AWS S3, Google Cloud, etc.
4. **Komprimierung:** Automatische Komprimierung für bestimmte Dateitypen
5. **Metadaten-Extraktion:** EXIF, PDF-Metadaten, etc.
6. **Verschlüsselung:** Ende-zu-Ende-Verschlüsselung der gespeicherten Dateien
