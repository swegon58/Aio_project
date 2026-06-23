# Common Weather Retrieval Errors

This file catalogs the most common error messages encountered when retrieving weather data, with their causes and recommended responses.

## Authorization Errors

### "Unauthorized: Invalid token"
```
Error: Unauthorized: Failed to search. Invalid token - No additional error details provided.
OR: Unauthorized: Failed to scrape. Invalid token
Location: web_search results / web_extract results
```

**Cause**: Weather.com and similar services require authentication headers that aren't provided through the web extraction tools in this environment.

**Response**: 
1. Switch to `browser_navigate` for direct browser access
2. Check page snapshot after navigation completes
3. Review console for blocking messages (see "Bot Detection" below)

### "Invalid Token" (web_extract only)
```
Error: Unauthorized: Failed to scrape. Invalid token
```

**Cause**: Same as above - the weather service is rejecting the extraction request due to missing auth headers.

**Response**: Use `browser_navigate + browser_snapshot` workflow instead.

## Bot Detection Signals

### Empty Page After Navigation
```
Snapshot: "(empty page)" OR "element_count": 0
Console: [no messages]
URL: https://weather.com/weather/today/l/Hanoi+VN (or similar)
```

**Cause**: The site has JavaScript that loads content only after verifying the client isn't a bot. When blocked, the page appears empty to automated tools.

**Response**: 
1. Check console for 403/429 responses or "blocked" messages
2. Try alternative weather services (AccuWeather, Windy.com)
3. Consider waiting and retrying if this is a temporary block
4. Note: This may require residential proxy mode on higher-tier plans

### Cloudflare Challenge Pages
```
Snapshot contains: "- link \"Just a moment...\"" OR heading "403"
```

**Cause**: Cloudflare protection page triggered before content loads.

**Response**: 
1. Attempt to wait for challenge completion (if any)
2. If stuck, try alternative weather service URL
3. Document that this domain has aggressive bot detection

## HTTP Error Patterns

### 404 Not Found
```
Title: "404 Not Found"
Heading: "Sorry, it looks like the wind blew this page away" (WMO example)
```

**Cause**: Either the location ID doesn't exist, the URL path is wrong, or the service uses different location identifiers.

**Response**: 
1. Try alternative weather service for same location
2. Search query format (e.g., `Hanoi+VN`) may work when specific IDs don't
3. Check if location name is spelled correctly in local language variants

### 5xx Server Errors
Look for HTTP status codes 500/502/503/504 in:
- Console output
- Network tab responses
- Header inspection

**Cause**: Temporary server issues, rate limiting, or backend failures.

**Response**: 
1. Wait 30-60 seconds and retry
2. If persistent, try alternative weather service
3. Document for later reference if repeated

## CORS/Fetch Errors

### "Failed to load resource: (cors)"
```
Console message contains: cors, cross-origin
```

**Cause**: Weather APIs require authentication headers; browser fetches from the tool's origin get blocked.

**Response**: 
1. Don't attempt direct API calls from weather extraction tools
2. Use full webpage content (HTML pages) instead of API endpoints
3. Consider browser mode which may handle CORS differently

## Console Message Patterns to Watch For

### Blocking Indicators
```javascript
"blocked": true, "block_reason": "bot_detected", // Common in bot detection pages
"Access denied for automated access", // Generic denial message  
"CORS policy prevents this request", // API endpoint blocked
Rate limit exceeded, too many requests  // Tempary block
```

### Success Indicators  
```javascript
"temperature", "humidity", "conditions": [], // Data loaded successfully
"hourly_forecast", "daily_forecast"          // Forecast data available
```

## Error Message Quick Reference

| Message Pattern | Tool | Action |
|-----------------|------|--------|
| "Invalid token" | web_search / web_extract | Switch to browser_navigate |
| "(empty page)" | browser_snapshot | Check console, try alternative service |
| "403/Just a moment..." | browser_snapshot | Wait or switch domain |
| "404 Not Found" | any | Try different URL format or service |
| "CORS policy" | web_extract | Use full page URLs not API endpoints |
| Rate limit message | any | Wait and retry, or use secondary service |

## Troubleshooting Checklist

When weather data can't be retrieved:

- [ ] Check error message type (auth vs bot vs HTTP error)
- [ ] Verify URL format matches expected pattern for region
- [ ] Try alternative weather service for same location
- [ ] Review console for additional clues (403, cors, etc.)
- [ ] If auth errors: switch to browser_navigate mode
- [ ] If bot detection: wait or use different domain
- [ ] Document which services work/fail for this region

## Notes on Tool Limitations

This session encountered repeated "Unauthorized" errors when using web_search and web_extract with weather.com. This appears to be a platform-level authentication requirement that's not configured in the current environment. The workaround is:

1. **Always have browser_navigate as primary fallback** for weather sites
2. **Check console early** to catch blocking before attempting extraction
3. **Try multiple URL patterns** - search query vs specific IDs may differ
4. **Consider regional alternatives** - local weather services often more responsive