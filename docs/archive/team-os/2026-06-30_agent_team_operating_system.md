# Hệ Vận Hành Aio Team OS

Cập nhật: 2026-06-30
Trạng thái: bộ vận hành thực tế để bắt đầu chạy `Aio Team OS`

## Mục Tiêu

Chuẩn bị cho việc chạy những gì đã grill và đã chốt bằng `Aio Team OS`,
với một hệ vận hành đủ thực tế để:

- main agent biết cách kéo chunk tiếp theo
- specialist biết nhận brief và trả handoff ra sao
- agent khác vào giữa chừng vẫn nối việc mượt
- founder vẫn giữ được góc nhìn như cách R0-R7 đã được ghi chép và chuyển giao

## Điều Đã Thiếu Trước Đây

Team-agent đã có:

- vai trò
- ownership
- rollout
- rule về context

Nhưng vẫn thiếu lớp vận hành thực chiến:

- file nào là nơi biết "đang làm gì"
- lúc nào phải viết brief
- lúc nào phải append handoff
- đâu là bộ nhớ chuyển ca ngắn nhất
- report founder-readable được tạo theo nhịp nào

## Hệ Mới Đã Được Chuẩn Bị

### 1. Cẩm nang vận hành

File:

- [OPERATING_PLAYBOOK.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/OPERATING_PLAYBOOK.md)
- [AIO_TEAM_OS_CHECKLIST.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/AIO_TEAM_OS_CHECKLIST.md)

Vai trò:

- hướng dẫn vòng lặp chuẩn cho main agent và specialist
- quy định cách mở chunk, giao việc, nhận handoff, tích hợp và chốt chunk
- checklist hóa các nhịp vận hành để không phụ thuộc vào trí nhớ phiên chat

### 2. Bộ mẫu dùng chung

Files:

- [ACTIVE_CHUNK_TEMPLATE.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/templates/ACTIVE_CHUNK_TEMPLATE.md)
- [CHUNK_BRIEF_TEMPLATE.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/templates/CHUNK_BRIEF_TEMPLATE.md)
- [HANDOFF_TEMPLATE.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/templates/HANDOFF_TEMPLATE.md)
- [FOUNDER_REPORT_TEMPLATE.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/templates/FOUNDER_REPORT_TEMPLATE.md)

Vai trò:

- ép brief và handoff về cùng một cấu trúc
- giảm mất mát thông tin khi đổi người làm

### 3. Bộ nhớ chuyển ca chuẩn

Files:

- [ACTIVE_CHUNK.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/coordination/ACTIVE_CHUNK.md)
- [HANDOFF_LOG.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/coordination/HANDOFF_LOG.md)

Vai trò:

- `ACTIVE_CHUNK.md`: câu trả lời ngắn nhất cho câu hỏi "đang làm gì"
- `HANDOFF_LOG.md`: lịch sử append-only của các lần giao/nhận việc

## Vì Sao Cách Này Gần Với R0-R7

Điểm mạnh của cách làm R0-R7 là:

- luôn có file neo
- luôn có phase checklist
- luôn có exact next step
- luôn có handoff đủ rõ để nối việc

Hệ mới giữ đúng tinh thần đó, nhưng bổ sung thêm lớp phù hợp với team-agent:

- `ACTIVE_CHUNK.md` đóng vai exact current step
- `HANDOFF_LOG.md` đóng vai nhật ký giao ca giữa agents
- founder report tiếp tục là lớp tóm tắt cho owner
- phase checklist và state file vẫn giữ vai trò nguồn sự thật cao nhất

## Cách Chạy Từ Bây Giờ

### Nếu main agent tiếp tục roadmap Aio

1. đọc `AIO_PROJECT_STATE.md`, `AIO_MASTER_EXECUTION_PLAN.md`, checklist phase hiện tại
2. đọc [TEAM_SPEC.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/TEAM_SPEC.md)
3. đọc [OPERATING_PLAYBOOK.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/OPERATING_PLAYBOOK.md)
4. cập nhật [ACTIVE_CHUNK.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/coordination/ACTIVE_CHUNK.md)
5. chỉ gọi specialist nếu thật sự có lợi về ngữ cảnh hoặc chất lượng
6. sau mỗi lần giao / nhận việc, append vào [HANDOFF_LOG.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/coordination/HANDOFF_LOG.md)
7. chốt chunk bằng founder report

### Nếu một agent khác vào giữa chừng

Agent đó chỉ cần đọc:

1. `AIO_PROJECT_STATE.md`
2. checklist phase hiện tại
3. [TEAM_SPEC.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/TEAM_SPEC.md)
4. [OPERATING_PLAYBOOK.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/OPERATING_PLAYBOOK.md)
5. [ACTIVE_CHUNK.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/coordination/ACTIVE_CHUNK.md)
6. [HANDOFF_LOG.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/coordination/HANDOFF_LOG.md)

Nếu cần bối cảnh lớn hơn nữa thì mới mở founder report gần nhất.

## Ý Hay Hơn So Với Chỉ Dùng Chat History

Điểm nâng cấp quan trọng nhất là:

- chat không còn là bộ nhớ chính
- file mới là bộ nhớ chính

Điều này tốt hơn vì:

- agent mới không cần đọc lại quá nhiều lịch sử
- file nào đã sửa, rủi ro nào còn mở, bước nào kế tiếp đều có chỗ neo rõ
- tránh mất thông tin khi session dài hoặc context bị nén

## Điều Mình Khuyên Làm Ngay Sau Bước Này

Áp dụng hệ này ngay vào chunk Aio thật kế tiếp, thay vì tiếp tục thiết kế trên giấy.

Ứng viên hợp lý nhất:

- chunk R6.6 kế tiếp

Làm vậy sẽ giúp mình kiểm tra:

- handoff có thật sự mượt không
- file nào còn thiếu
- template nào còn quá dài hoặc quá ngắn

## Bạn Cần Quyết Định Gì

Chưa cần quyết định gì ngay.

Nếu bạn muốn, bước tiếp theo mình sẽ:

- khởi tạo luôn `ACTIVE_CHUNK.md` cho chunk Aio thực chiến kế tiếp
- rồi bắt đầu chạy hệ này trên công việc thật
