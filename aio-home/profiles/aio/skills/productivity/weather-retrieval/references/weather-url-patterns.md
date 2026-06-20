# Weather URL Patterns by Region

## Format Notes
- **Weather.com** requires location IDs. Common patterns:
  - `https://weather.com/weather/today/l/[SEARCH_QUERY]` (browser fallback if search fails)
  - `https://weather.com/weather/today/l/[LOCATION_ID]:[STATE_CODE]:[COUNTRY]` (if known ID available)

## Asia/Pacific

### Vietnam
| City | URL Pattern | Notes |
|------|-------------|-------|
| Hanoi | `https://weather.com/weather/today/l/Hanoi+VN` | Search query format |
| Ho Chi Minh City | `https://weather.com/weather/today/l/Saigon+VN` | Alternate name accepted |
| Da Nang | `https://weather.com/weather/today/l/Danang+VN` | Same pattern works |

### Japan
| City | URL Pattern | Notes |
|------|-------------|-------|
| Tokyo | `https://weather.com/weather/today/l/Tokyo+JP` | Search query format |
| Osaka | `https://weather.com/weather/today/l/Osaka+JP` | Same pattern works |

### South Korea
| City | URL Pattern | Notes |
|------|-------------|-------|
| Seoul | `https://weather.com/weather/today/l/Seoul+KR` | Search query format |
| Busan | `https://weather.com/weather/today/l/Busan+KR` | Same pattern works |

## Europe

### United Kingdom
| City | URL Pattern | Notes |
|------|-------------|-------|
| London | `https://weather.com/weather/today/l/London+UK` | Search query format |
| Manchester | `https://weather.com/weather/today/l/Manchester+UK` | Same pattern works |

### Germany  
| City | URL Pattern | Notes |
|------|-------------|-------|
| Berlin | `https://weather.com/weather/today/l/Berlin+DE` | Search query format |
| Munich | `https://weather.com/weather/today/l/Munich+DE` | Same pattern works |

## North America

### United States
| City | URL Pattern | Notes |
|------|-------------|-------|
| New York | `https://weather.com/weather/today/l/New-York+NY:US` | State code required for accuracy |
| Los Angeles | `https://weather.com/weather/today/l/Los-Angeles+CA:US` | Use state abbreviation |

### Canada  
| City | URL Pattern | Notes |
|------|-------------|-------|
| Toronto | `https://weather.com/weather/today/l/Toronto+ON:CA` | Canadian sites prefer CA extension |
| Vancouver | `https://weather.com/weather/today/l/Vancouver+BC:CA` | Same pattern works |

## Error Pattern Reference

### "Unauthorized" Errors
```
Error: Unauthorized: Failed to search. Invalid token - No additional error details provided.
Action Required: Switch to browser_navigate + manual inspection
```

### Empty Page After Navigation
```
Snapshot result: "(empty page)" or "element_count": 0
Cause: Bot detection blocked content loading
Action Required: Check console messages, try alternative URL formats
```

### CORS/Scrape Failures
```
Error: Unauthorized: Failed to scrape. Invalid token
Location: web_extract results array
Action Required: Use browser_navigate with snapshot inspection instead
```

## Alternative Weather Services (Browser-Compatible)

| Service | Base URL | Notes |
|---------|----------|-------|
| AccuWeather | `https://www.accuweather.com/en/[COUNTRY]/[city-code]/[ID]` | Requires city numeric ID lookup first |
| Windy.com | `https://www.windy.com/` | Interactive map-based, good for visual confirmation |
| Dark Sky | `https://darksky.net` | Deprecated API, may redirect to other services |

## Regional Alternatives

Some regions have better local alternatives:
- **Vietnam**: Try Vietnamese-language weather sites for Hanoi/HCMC (more responsive)
- **UK/Europe**: BBC Weather (`bbc.co.uk/weather`) often works where US sites block
- **Japan**: Yahoo Japan Weather (`weather.yahoo.co.jp`) frequently bypasses blocks

## Testing Protocol

When a weather site returns errors:
1. Record the exact error message and URL attempted
2. Check console for 403/405/missing content warnings  
3. Try alternative format (e.g., country+city vs full address)
4. Switch to browser_navigate if web_extract repeatedly fails
5. Document which services worked for this region (add to notes)