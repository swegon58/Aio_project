# Grill log: /app right-panel + sidebar + terminal + chat-bubble redesign (2026-06-24)

## Original spec (verbatim, Vietnamese, from reference image "Willow AI Agent Platform")

> hãy điều chỉnh cả cái side tab phải như thế này cho tôi. tab info hiện tại biến thành giống như card đầu tiên trên phải, nhưng chỉ có hình Aio trong đó và liên kết với live status tool calling kèm dòng chữ status, không có progress bar. bỏ tab mcp hiện tại. task progress sẽ kèm chung vào tab đầu, đặt bên dưới hình Aio. tiếp theo bên dưới là tab Gallery & Files. Recent activity cũng gọp vào bên dưới chung với tab đầu tiên ở trên. terminal thì thiết kế lại giống như trong hình luôn, bỏ cái hình Aio terminal mà lúc trước tôi kêu làm đi. side tab trái cũng thiết kế lại giống như hình, có các icon tính năng trong đó nhưng là placeholder thôi, tôi sẽ làm thêm sau, nhưng cho nó auto sổ ra khi hover, còn khi không hover thì nó sẽ tự thu gọn lại chỉ còn icon chứ ko còn chữ. ở khung chat, hãy cho nội dung trả lời của agent cũng nằm trong bubble nhưng blur, match màu với theme.

8 sub-reqs: (1) Status tab = avatar + live status text only, no progress bar in that card; (2) remove MCP tab; (3) Task progress folds into tab 1 below avatar; (4) "Gallery & Files" tab below Task progress; (5) Recent activity folds into tab 1 below Task progress; (6) redesign Aio Terminal to match image, drop old "Aio Terminal" frame UI; (7) redesign left sidebar to match image — placeholder feature icons, auto-expand on hover, auto-collapse to icon-only otherwise; (8) agent chat bubbles get blurred bg matching theme.

## Q1 — Memory tab / Kanban+Tasks fate
1. Keep Memory as separate 3rd tab; fold Kanban+Tasks/cron into Task Progress. **← picked**
2. (other option not recorded)

## Q2 — "live status tool calling" detail level
1. (Rec) Show specific tool name + verb while running ("Running bash...", "Searching web...") from tool-call event, fallback "Idle". **← picked** (user also asked UI copy in English: "Aio is searching... / Aio is coding...")
2. Just "Live"/"Idle" stat, no detail.
3. Generic "Thinking..." snippet, no tool name.

## Q3 — Recent activity feed scope
1. Tool-call history only.
2. Tool calls + meta events (renamed convo, uploaded file, settings changed). **← picked**

## Q4 — Terminal redesign scope
1. Drop "AIO TERMINAL" header + accent border, keep Code/Preview sub-tabs, restyle to clean card look. **← picked**
2. Same + add 3rd "Results" sub-tab.

## Q5 — Theme
1. Keep Aio's dark theme, copy layout/structure only from the light reference image. **← picked**
2. Switch whole /app to light theme.

## Q6 — Chat bubble blur
1. Agent bubble only, blurred bg matching accent, user bubble stays solid. **← picked**
2. Both bubbles blurred.

## Q7 — Left sidebar icon set
1. Map to Aio's existing concepts (New Chat/Conversations/Settings + 2-3 placeholders).
2. Copy reference image's exact set: Home/Agents/Tasks/Knowledge/Analytics/Settings, placeholders. **← picked**

## Q8 — Hover-expand sidebar, desktop only?
1. Desktop/tablet only, mobile keeps old hamburger sidebar untouched.
2. Tap-to-peek on mobile too. **← picked** — elaboration (verbatim): "trên mobile thì click vào button side tab đó ra khoảng 80% màn hình thôi, và phải luôn hiện cái button ở góc trên, không có top bar như desktop nhé, hãy tham khảo các app mobile khác như chatgpt hay manus, nó luôn có button chức năng ở trên." → mobile tap opens rail to ~80% screen width, persistent fixed top-corner toggle button, no desktop-style top bar on mobile.

## Q9 — Session Stats grid (Messages/Tool Calls/Credits/Status)
1. Keep in tab 1.
2. Remove — tab 1 only avatar+status+task progress+recent activity. **← picked** (moot: this grid didn't exist in current code at implementation time)

## Q10 — Gallery & Files layout
1. Pill toggle at top of tab 2 (Gallery/Files), switches view. **← picked**
2. Stack both sections vertically in one scroll.

## Q11 — Where does "Recent Chats" (New Chat + conversation list) live once sidebar becomes icon-rail?
1. Two layers: thin icon-rail (hover expands with labels) + separate "Recent Chats" panel beside it, independent open/close — Discord/Slack pattern. **← picked**, user noted "thử xem, tôi chưa biết rõ như thế nào" (try it, not fully sure how it'll look)
2. "Home" icon = entry point to Recent Chats as submenu/overlay.
3. Single sidebar that self-collapses to icon-only, no second layer.

## Implementation status as of 2026-06-24 (verified against code, commit 2d5c003)
- Done: Status/Memory/Files panel restructure (Q1,Q3,Q9,Q10), terminal header/frame removal (Q4), chat bubble blur (Q6 — agent only).
- Done: left sidebar icon-rail (`ICON_RAIL_ITEMS`, hover-expand on desktop) + two-layer Recent Chats (separate `<aside className="sidebar">` beside the rail, Discord/Slack pattern — Q7, Q11). Mobile tap-to-peek 80vw sheet + `icon-rail-mobile-toggle` persistent corner button (Q8). All landed in `AppHome.tsx`/`mockup.css`, committed `2d5c003` 2026-06-24.
- New, not yet grilled: "agent capability showcase" cards in chat (inline code-exec/web-research/doc-analysis structured cards, mirrored in right panel) — requested 2026-06-24 with 3 reference images (Willow app: code exec+results table, web research w/ sources+key insights, PDF doc understanding w/ summary+key insights+action items). Needs its own grill round before building — backend (harness) must emit structured task-type data, not just file/tool events.
