# Flutter Web Caching Strategy

## Problem
Flutter web apps don't update correctly when new builds are deployed because browsers cache old files.

## Solution Implemented

### 1. Server-Side Caching Headers

**Never Cache (Always Fresh):**
- `index.html` - Entry point must always be fresh
- `flutter_service_worker.js` - Service worker must update immediately
- `version.json` - Version info must be current

**Short-Lived Cache:**
- `flutter.js` & `flutter_bootstrap.js` - Check for updates on each visit
- Other JS files - 1 hour cache with revalidation

**Long-Term Cache (Immutable):**
- `assets/*` - Asset files with hashed names never change
- `canvaskit/*` - CanvasKit files with version in path
- `main.dart.*.js` - Hashed JS files
- `*.wasm` - WebAssembly files

### 2. Flutter Side Configuration

Add to your Flutter `web/index.html`:

```html
<script>
  // Force check for new version on page load
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.update(); // Force service worker update
      }
    });
  }
</script>
```

### 3. Version Management

Create `web/version.json` in your Flutter project:

```json
{
  "version": "1.0.0",
  "buildNumber": "1",
  "buildDate": "2025-10-21T12:00:00Z"
}
```

Update this file on each build to force cache invalidation.

### 4. Build Process

Add to your Flutter build script:

```bash
# Generate version.json with timestamp
cat > web/version.json << EOF
{
  "version": "$(grep 'version:' pubspec.yaml | cut -d ' ' -f2)",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Build with cache busting
flutter build web --release --web-renderer canvaskit
```

### 5. Force Update on Client

In your Flutter app, add version checking:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> checkForUpdates() async {
  try {
    final response = await http.get(
      Uri.parse('/version.json?t=${DateTime.now().millisecondsSinceEpoch}'),
    );
    
    if (response.statusCode == 200) {
      final serverVersion = json.decode(response.body);
      final currentVersion = const String.fromEnvironment('APP_VERSION');
      
      if (serverVersion['version'] != currentVersion) {
        // Show update dialog or force reload
        if (kIsWeb) {
          html.window.location.reload();
        }
      }
    }
  } catch (e) {
    print('Version check failed: $e');
  }
}
```

### 6. Manual Cache Clear (for testing)

Users can force a refresh:
- Chrome/Edge: `Ctrl + Shift + R` or `Ctrl + F5`
- Firefox: `Ctrl + Shift + R`
- Safari: `Cmd + Option + R`

Or clear site data:
- Chrome DevTools → Application → Clear Storage → Clear site data

### 7. Service Worker Strategy

Modify `flutter_service_worker.js` caching behavior in `web/index.html`:

```html
<script>
  var serviceWorkerVersion = new Date().getTime(); // Always fresh version
</script>
```

## Testing

1. Deploy new build
2. Check network tab in DevTools
3. Verify `index.html` returns `Cache-Control: no-cache`
4. Verify `main.dart.*.js` returns `Cache-Control: immutable`
5. Force refresh and confirm new version loads

## Common Issues

**Issue:** App still shows old version after deployment
**Solution:** 
1. Check if service worker is registered: DevTools → Application → Service Workers
2. Unregister old service workers
3. Clear browser cache
4. Hard refresh (Ctrl + Shift + R)

**Issue:** Assets not loading
**Solution:** Check CORS headers and ensure paths are correct

**Issue:** Infinite reload loop
**Solution:** Ensure version check doesn't trigger on every load, only on app start
