# Việc để dành cho chủ nhân — sau nhánh học open-webui

> Ghi ngày 2026-07-05. Đây là danh sách **việc tôi không tự làm được** (cần bạn
> quyết / duyệt) hoặc **cần nhiều sprint** (làm từng phần sau). Ngôn ngữ đời thường.

## 🚧 Cần bạn duyệt (cửa owner)

### 1. Push migration `0031` (tìm kiếm lai Knowledge) lên Supabase production
- **Đã làm:** viết xong + test pass ở Supabase local. Tìm kiếm Knowledge giờ lai
  BM25 + vector (giống open-webui), chất lượng truy xuất tốt hơn.
- **Cần bạn:** push migration `0031_knowledge_hybrid_search.sql` lên remote
  Supabase. Theo quy tắc đây là cửa owner (xem `docs/operations/OWNER_CLOSEOUT_CHECKLIST.md`).
- **Sau khi push:** tìm kiếm lai sẽ chạy thật cho người dùng.

### 2. Migration cho Valves — đã viết xong (khác với ghi trước đây)
- **Cập nhật 2026-07-06:** đã viết + test pass local rồi, không còn "chưa viết"
  nữa. Xem mục ✅ #4 bên dưới. Migration `0032_aio_tool_valves.sql` cũng đang
  đợi push cùng đợt với #1 ở trên (cả hai đều untracked, chưa push remote).

## 🎯 Cần bạn quyết (kiến trúc, không tự quyết được)

### 3. Knowledge thành toolset cho agent (Tier 1 mục 3) — endpoint xong, còn thiếu dây nối Hermes
- **Câu hỏi:** hôm nay Aio **luôn nhét** top-5 đoạn Knowledge vào mỗi lượt chat.
  open-webui thì cho **agent tự quyết** khi nào query, và chọn kiểu (semantic /
  grep / theo tên file).
- **Bạn cần chốt:** giữ "luôn nhét" hay chuyển sang "agent tự query"? Hai hướng
  khác hẳn trải nghiệm + chi phí.
- **Cập nhật 2026-07-06 — đã làm (a):** endpoint nội bộ đã code xong và chạy
  được — `/api/internal/knowledge/query` +  `/api/internal/knowledge/grep`
  (khoá bằng header `x-aio-internal-secret`). **Chưa làm (b)(c):** chưa có
  Hermes tool nào gọi ngược hai endpoint này (grep xác nhận không có caller
  nào ngoài chính route), và chưa phân phối secret cho Hermes runtime. Tức là
  hạ tầng đã sẵn, chỉ còn thiếu dây nối — vẫn cần bạn chốt có làm (b)(c) hay
  không trước khi nối.

### 4. Valves (config tool trong UI, không redeploy) — đã làm xong, đang chờ push
- **Cập nhật 2026-07-06:** không còn là "bỏ qua vì YAGNI" nữa — có nhu cầu cụ
  thể xuất hiện (chỉnh trọng số BM25 vs vector cho Knowledge), nên đã làm gọn
  đúng như dự tính: migration `0032_aio_tool_valves.sql` (bảng
  `aio_tool_valves`), reader `getToolValves()` trong
  `lib/aio/knowledge/valves.ts`, route `/api/account/valves`, và 1 slider
  trong tab Knowledge của Settings — đã test local. Chỉ còn chờ push migration
  `0032` lên remote cùng đợt với #1.

## 📌 Còn lại (làm dần, không gấp)

- **Web-search abstraction (Tier 2 mục 5):** nền cho "Research mode" theo dõi
  arXiv/market/blog. Khi nào bật Research mode mới làm.
- **Tool taxonomy split (Tier 2 mục 6):** tách rõ Hermes-tool / MCP / OpenAPI.
  Khi thêm tool mới nhiều thì làm cho sạch.
- **Tier 3 (UX nhỏ) còn lại:** message queue, `#` multi-resource, multi-model
  so sánh. Lót tay trong đợt polish UI sau. (Biến `{{ USER_NAME }}`/
  `{{ CURRENT_DATE }}` trong prompt đã làm xong — xem mục ✅ bên dưới.)

## ✅ Đã làm xong (không cần bạn)

- **Hợp đồng trích nguồn Deep Research** (citation `[N]` + chống bịa nguồn) —
  `apps/web/src/lib/aio/chat/research-mode.ts`.
- **Tìm kiếm lai Knowledge** (BM25 + vector, test local pass) — migration `0031`
  + `retrieve-context.ts`. Chỉ còn #1 (push) là cần bạn.
- **Valves** (config runtime cho tool Knowledge, không cần redeploy) —
  migration `0032` + `valves.ts` + `/api/account/valves` + Settings slider.
  Test local xong. Chỉ còn push migration là cần bạn (đi cùng #1).
- **Endpoint nội bộ Knowledge** (`/api/internal/knowledge/query`, `/grep`) —
  code xong, chạy được. Còn thiếu dây nối Hermes-tool (xem #3).
- **Biến prompt `{{ USER_NAME }}` / `{{ CURRENT_DATE }}`** —
  `lib/aio/chat/prompt-variables.ts`, nối vào `run-orchestrator.ts` cho mọi
  đoạn prompt (guardrail/plan/research/saved agent/knowledge).
- **AppHome.tsx tách hook + context + section** (không thuộc open-webui,
  nhưng đi cùng đợt) — xem `R12_GIAI_THICH_DE_HIEU.md`.
- **Doc dễ hiểu cập nhật R8–R12** trong folder này.
- **Doc nghiên cứu open-webui** trong worktree onyx (`onyx-openmanus-aio-integration-notes.md`).
