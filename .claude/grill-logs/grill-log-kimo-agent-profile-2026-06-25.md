# Grill log: Kimo (UI/UX critic agent) profile — 2026-06-25

Bối cảnh: sau khi sửa pink message-bubble, user yêu cầu dựng 1 agent profile "Kimo" — chuyên gia UI/UX khó tính, review/phê bình thẳng thắn, tự dùng Playwright test, được giao task khi cần.

## Câu 1: Lưu profile ở đâu?
- Options: (a) global `~/.claude/agents/` / (b) project `.claude/agents/` / (c) cả hai (global skeleton + project override)
- **Chọn: B**, nhưng phạm vi đánh giá = **toàn bộ Aio UI** (không chỉ `/app`), theo elaboration của user.

## Câu 2: Phạm vi quyền?
- Options: (a) chỉ đọc + Playwright / (b) đọc + Playwright + sửa code nhỏ rõ ràng, không commit/push / (c) chỉ đọc, không sửa gì cả
- **Chọn: B**

## Câu 2.1 (follow-up, user tự nêu): nếu sau này có thêm agent "Codo" (chuyên gia code), Kimo và Codo giao tiếp được không?
- Trả lời trong câu 6.

## Câu 3: Format output đánh giá?
- Options: (a) văn xuôi tự do / (b) structured: severity + vị trí + vấn đề + vì sao tệ + đề xuất / (c) checklist pass/fail cố định
- **Chọn: B**

## Câu 4: Tiêu chí "khó tính" dựa trên gì?
- Options: (a) hoàn toàn taste-skill / (b) taste-skill làm nền + viết thêm tiêu chí riêng cho dense product UI / (c) tự do không neo skill nào
- **Chọn: B**
- Follow-up của user: sửa thẳng vào `taste-skill/SKILL.md` hay viết riêng — lo ngại load nặng mỗi session/message.
- **Quyết định**: viết tiêu chí riêng **inline trong `kimo.md`** (không đụng `taste-skill/SKILL.md` — skill đó dùng chung cho landing page, sửa vào sẽ lệch mục đích gốc). Agent definition file chỉ load khi agent đó được gọi (giống skill, không tự load mỗi session/message) — nên không có vấn đề tốn token mặc định.

## Câu 5: Cách gọi Kimo?
- Options: (a) Agent tool, `subagent_type: "kimo"` (fresh agent, custom definition) / (b) Agent tool `subagent_type: "fork"` + persona trong prompt / (c) tự áp persona vào chính mình, không qua Agent tool
- **Chọn: A**

## Câu 6: Kimo ↔ Codo (agent code tương lai) giao tiếp kiểu gì?
- Options: (a) qua Claude (orchestrator) làm trung gian / (b) cho Kimo quyền Agent tool để tự gọi thẳng Codo
- **Chọn: A** — Kimo KHÔNG có quyền Agent tool, không tự gọi agent khác. Nếu vấn đề cần chuyển cho code-agent, Kimo chỉ ghi rõ trong report, Claude (orchestrator) quyết định giao cho ai.

## Câu 7: Dựng Codo luôn hay để sau?
- Options: (a) chỉ làm Kimo task này, Codo để sau / (b) dựng cả 2 khung sơ bộ luôn
- **Chọn: A**

## Câu hỏi làm rõ (không phải nhánh quyết định): gọi Kimo có tốn rate-limit/đọc lại toàn bộ codebase không?
- Trả lời: Kimo là fresh agent (subagent_type "kimo", không fork) — không tự đọc lại conversation hay toàn bộ codebase. Chỉ đọc đúng phạm vi mà orchestrator (Claude) ghi trong prompt giao task. Chi phí phụ thuộc vào việc scope task chặt hay lỏng khi giao — kỷ luật nằm ở lúc giao task, không phải thuộc tính cố định của agent. Áp dụng tương tự cho Codo sau này.

## Kết quả
Tạo file `/home/swegon/AI_Agent/Aio_project/.claude/agents/kimo.md` — agent definition đầy đủ (phạm vi, quyền hạn, tiêu chí đánh giá dựa trên taste-skill + tiêu chí riêng cho dense product UI, format output, quy tắc không commit/không tự gọi agent khác).
