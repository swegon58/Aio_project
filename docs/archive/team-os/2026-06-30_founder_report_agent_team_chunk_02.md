# Báo Cáo Cho Nhà Sáng Lập - Phần Team Agent 02

Cập nhật: 2026-06-30

## Mục Tiêu

Làm cho team agent nội bộ mới của Aio dùng được trong vận hành thật, không chỉ dừng ở mức tài liệu, bằng cách định nghĩa lộ trình triển khai và hàng rào rõ ràng cho ngữ cảnh/token.

## Đã Hoàn Thành

- Mở rộng bản đặc tả team chuẩn với:
  - quy tắc cho kỷ luật ngữ cảnh và chi phí
  - thứ tự leo thang mặc định
  - các giai đoạn triển khai T1-T5
  - hướng dẫn bàn giao rõ hơn
  Liên kết:
  [TEAM_SPEC.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/TEAM_SPEC.md)
- Viết một ghi chú triển khai dễ đọc cho nhà sáng lập, giải thích cách đưa team này vào dùng dần dần trong lúc vẫn tiếp tục giao hàng Aio bình thường:
  [2026-06-30_agent_team_rollout_plan.md](/home/swegon/AI_Agent/Aio_project/docs/roadmap/2026-06-30_agent_team_rollout_plan.md)

## Tác Động

- Team giờ có lộ trình áp dụng theo từng chặng thay vì triển khai một lần toàn bộ.
- Mình đã đặt lớp bảo vệ rõ ràng trước kiểu hỏng phổ biến nhất của hệ nhiều agent trong bối cảnh này: chi phí điều phối và mức đốt ngữ cảnh tăng lên nhưng chất lượng không tăng tương xứng.
- Điều này giúp dùng team trong R6 và R7 an toàn hơn, không để quy trình trở nên nặng nề hoặc mang tính trình diễn.

## Ghi Chú Quan Trọng

- Mặc định được khuyến nghị vẫn là nhẹ: điều phối viên trước, một người chuyên trách khi cần, người rà soát gần cuối chỉ khi thật sự đáng.
- Mình cố ý chưa thêm agent mới nào nữa. Ở giai đoạn này, ranh giới sắc hơn có giá trị hơn một danh sách vai trò lớn hơn.

## Bạn Cần Quyết Định Gì

Chưa cần gì ngay lúc này.

Quyết định hữu ích tiếp theo sẽ đến sau thêm vài phần việc giao diện hướng người dùng thật:

- giữ `kimo` làm reviewer thử nghiệm
- hoặc nâng vai trò đó thành một phần chính thức của nhóm nòng cốt
