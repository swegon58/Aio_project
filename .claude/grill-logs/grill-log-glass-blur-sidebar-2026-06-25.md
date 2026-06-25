# Grill log: Glass-blur utility + icon-rail spacing — 2026-06-25

Reference: ChatGPT_Image (Willow-style icon rail, evenly spaced icons, avatar separate at bottom)
+ message.txt (gradient-card-showcase.tsx) — only the glass technique extracted, not the skew/gradient card itself.

## Câu 1: Phạm vi áp dụng glass-blur ("etc" gồm gì)?
- Options: (a) chỉ 3 thứ named (chat bubble/tab bg/card) / (b) 3 thứ đó + utility class chung cho component mới sau này
- **Chọn: B** — tạo `.glass-surface` (hoặc tương đương) dùng lại được.

## Câu 2: Giữ y số liệu rgba/blur trong code mẫu hay chỉnh cho dark theme?
- Options: (a) giữ y nguyên / (b) giữ kỹ thuật, tự chỉnh opacity/blur cho rõ trên dark bg
- **Chọn: B**

## Câu 3: Tên branch?
- Options: (a) feat/glass-blur-ui / (b) feat/ui-glass-and-sidebar-spacing / (c) 2 branch riêng
- **Chọn: B, nhưng đặt theo ngày** → branch thực tế: `feat/2026-06-25-ui-glass-and-sidebar-spacing`
- User note verbatim: "branch đặt theo ngày để dễ kiểm"
