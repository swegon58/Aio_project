---
name: weather-retrieval
description: Retrieve current weather data, climate info, and geographic information for locations
trigger: User asks for "current weather in [location]" or needs temperature/conditions/forecasts for a geographic location
---

# Weather and Geo Data Retrieval

Use this skill when you need current weather information, climate data, or geographic information for a specific location.

## Trigger Conditions

- User asks for "current weather in [location]"
- Request for temperature, conditions, or forecasts for geographic locations  
- Need to compare weather across multiple locations
- Finding alternative data sources after primary sites fail

## Workflows

### Primary: Direct Weather Services
Use official weather provider pages directly:
- **Weather.com**: `https://weather.com/weather/today/l/[LOCATION_ID]:[STATE_CODE]` or try search query-based URLs like `Hanoi+VN`
- **AccuWeather**: `https://www.accuweather.com/en/[COUNTRY]/[city-code]` (e.g., `/vn/hanoi/37408`)

### Fallback: Browser Navigation Mode
When web_search or web_extract fails with authorization errors, switch to browser_navigate:
1. Attempt direct navigation to weather site
2. Check page snapshot for content availability
3. Review console for blocking messages

### Secondary: Alternative Services
If primary sources fail due to bot detection:
- Try different weather service URLs in browser mode
- Consider public API endpoints where CORS allows extraction

## Common Pitfalls

### Authorization Errors
Weather.com and similar sites return "Unauthorized: Invalid token" via web_search/web_extract. This is a setup requirement, not a tool limitation—requires residential proxy or direct browser access.

### Bot Detection on Weather Domains
Sites like weather.com block automated requests by default. Signs include:
- Empty page snapshots after successful navigation
- No interactive elements detected
- Console warnings about bot detection

### CORS/Extract Restrictions  
Many weather APIs require authenticated headers. web_extract will fail with "Failed to scrape" if headers are missing. Solution: use browser_navigate + manual snapshot inspection instead.

### WMO URL Patterns Don't Always Work
World Meteorological Organization climate data pages often return 404 or require specific location identifiers that aren't publicly indexed. Avoid relying on these without prior verification.

## Tips

- **Always have browser_navigate as fallback**: Web extraction tools frequently fail on weather domains due to auth/token requirements
- **Check console for blocking messages**: Silent rejections appear in console errors rather than page content
- **Try multiple URL patterns**: Location IDs, country+city combinations, and alternative service URLs often yield different results
- **Don't cache "broken" assumptions**: A 404 or empty page doesn't mean data doesn't exist—it means the tool is being blocked

## References

See `references/` for:
- See `references/weather-url-patterns.md` for tested URL patterns by region, error message guides, alternative services, and testing protocols
- See `references/error-patterns.md` for common error message catalog with causes and responses, console message interpretation, troubleshooting checklist, and tool limitations notes
- Common error messages and their meanings  
- Alternative weather service comparison notes