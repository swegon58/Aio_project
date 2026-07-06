# Kế Hoạch Triển Khai Aio Team OS

Cập nhật: 2026-06-30
Trạng thái: ghi chú triển khai đang làm việc cho team nội bộ xây dựng Aio

## Mục Tiêu

Biến `Aio Team OS` thành một hệ điều hành làm việc thực dụng:

- giảm gánh điều phối cho nhà sáng lập
- tăng độ chỉn chu của sản phẩm và chất lượng rà soát
- tránh lãng phí ngữ cảnh và token không cần thiết

Kế hoạch này nói về team xây dựng Aio, không phải tính năng nhiều agent lộ ra cho người dùng cuối.

## Hình Dạng Hiện Tại

Bản đặc tả team và các hồ sơ hiện có:

- [TEAM_SPEC.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/TEAM_SPEC.md)
- [frontend-builder.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/frontend-builder.md)
- [backend-builder.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/backend-builder.md)
- [product-ux-guardian.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/product-ux-guardian.md)
- [qa-reviewer.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/qa-reviewer.md)
- [kimo.md](/home/swegon/AI_Agent/Aio_project/.claude/agents/kimo.md)

Điều phối viên chính hiện vẫn ở dạng ngầm. Điều này là tốt ở giai đoạn này vì giúp hệ thống nhẹ hơn trong lúc mình kiểm chứng giá trị thực của các vai trò chuyên trách bằng công việc thật.

## Nguyên Tắc Vận Hành

1. Owner kiểm soát roadmap và duyệt phase.
2. Team kiểm soát chi tiết triển khai bên trong phạm vi đã được duyệt.
3. Bắt đầu với số agent ít nhất nhưng vẫn đủ làm tốt việc.
4. Chỉ thêm specialist khi nó tạo ra giá trị thật về tách ngữ cảnh hoặc chất lượng rà soát, không phải để chia vai cho đẹp.
5. Tệp trong repo là lớp bộ nhớ bền; chat không phải nguồn sự thật.
6. Báo cáo phải dễ đọc cho nhà sáng lập và dễ lướt nhanh.

## Các Giai Đoạn Rollout

### Giai Đoạn T1 - Nền Tảng

Ý nghĩa:

- team đã tồn tại trên đĩa
- mỗi người chuyên trách nòng cốt có phạm vi rõ ràng
- có một reviewer thử nghiệm nhưng chưa mở rộng quá sớm

Vì sao giai đoạn này quan trọng:

- nó biến ý tưởng trừu tượng thành quy tắc vận hành có thể chạy được

Trạng thái:

- hoàn tất

### Giai Đoạn T2 - Nhịp Vận Hành

Những gì bắt đầu áp dụng:

- mỗi phần triển khai có ý nghĩa đều bắt đầu bằng bản tóm tắt ngắn
- người chuyên trách trả về phần bàn giao ngắn có cấu trúc
- mỗi phần hoàn thành có ý nghĩa tạo một báo cáo ngắn, dễ đọc cho nhà sáng lập

Vì sao giai đoạn này quan trọng:

- đây là lúc team ngừng là tài liệu tĩnh và bắt đầu trở thành một thói quen giao việc lặp lại được

Tiêu chí thành công:

- bạn có thể nói "continue Aio" hoặc "làm chunk tiếp theo" mà không cần điều phối từng bước ở mức code

### Giai Đoạn T3 - Vòng Rà Soát Sản Phẩm

Những gì bắt đầu áp dụng:

- Product / UX và `kimo` rà soát các thay đổi hướng người dùng ở những điểm chặn chọn lọc
- UI và câu chữ được kiểm tra theo các quy tắc ngôn ngữ an toàn cho người dùng
- việc lộ backend/provider/runtime được xem là lỗi sản phẩm

Vì sao giai đoạn này quan trọng:

- đây là giai đoạn làm Aio có cảm giác chỉn chu thay vì chỉ đơn thuần chạy được

Tiêu chí thành công:

- ít phải sửa muộn hơn về câu chữ UI, chữ trên nút, văn bản trạng thái và độ mạch lạc thị giác

### Giai Đoạn T4 - Bộ Nhớ Team Bền Vững

Những gì bắt đầu áp dụng:

- các quyết định, ràng buộc và lỗi lặp lại có ý nghĩa được ghi vào ghi chú repo và báo cáo ngắn
- team tiếp tục công việc bằng tệp thay vì liên tục dựng lại ngữ cảnh từ lịch sử chat

Vì sao giai đoạn này quan trọng:

- đây là lớp phòng thủ chính trước hiện tượng suy giảm ngữ cảnh của các phiên làm việc dài

Tiêu chí thành công:

- các quyết định cũ có thể được nối lại chính xác mà không cần grill lại cùng một vấn đề

### Giai Đoạn T5 - Nâng Cấp Và Tinh Gọn

Những gì bắt đầu áp dụng:

- quyết định xem `kimo` có nên trở thành reviewer chính thức trong nhóm nòng cốt không
- quyết định xem người chuyên trách nào còn thiếu thật sự đáng thêm vào
- loại bỏ hoặc hạ mức ưu tiên những vai trò làm tăng chi phí điều phối mà không mang lại giá trị rõ ràng

Vì sao giai đoạn này quan trọng:

- một team agent tốt phải sắc hơn theo thời gian, không phải cứ lớn dần lên

Tiêu chí thành công:

- mỗi vai trò đang hoạt động đều chứng minh được giá trị bằng các kết quả lặp lại trong công việc thật

## Chính Sách Context Và Token

Đây là hàng rào chính để team này hữu ích thay vì nặng nề.

Mẫu ưu tiên:

- điều phối viên trước
- một người chuyên trách khi cần
- một người rà soát gần cuối khi rủi ro hoặc nhu cầu chỉn chu đủ lớn để biện minh

Mặc định cần tránh:

- gọi nhiều người chuyên trách song song cho tác vụ nhỏ
- để nhiều agent cùng đọc lại một lịch sử dài
- tạo agent mới chỉ vì task nghe có vẻ quan trọng
- rà soát khi chưa có đầu ra đủ đáng để xem

Phiên bản ngắn:

- nhiều agent hơn không tự động tốt hơn
- ranh giới tốt hơn và tệp phục hồi tốt hơn thường mới là lợi ích thật

## Team Này Gắn Với R6 Và R7 Như Thế Nào

Ứng dụng phù hợp nhất trong phase sản phẩm hiện tại:

- dùng Frontend, Product / UX và `kimo` nhiều cho các phần việc hướng người dùng của R6 và R7
- dùng Backend cho durable contracts, APIs, persistence và deployment plumbing
- dùng QA / Reviewer làm cổng cuối về rủi ro cho các phần việc hoàn thành có ý nghĩa

Điều này giúp team agent được kiểm chứng ngay trong đúng công việc Aio đang cần ship, thay vì tạo một track thử nghiệm tách riêng.

## Những Candidate Agent Có Thể Xem Xét Sau

Chưa làm ngay, nhưng đáng nhớ về sau khi core team chứng minh được giá trị:

- người rà soát UI sản phẩm nhẹ và hẹp hơn `kimo`
- người chuyên trách hệ nghiên cứu cho chất lượng nguồn, tổng hợp và độ tin cậy của đầu ra
- người rà soát tăng trưởng / khởi động ban đầu cho chuyển đổi beta và độ rõ ở lần dùng đầu
- người chuyên trách hệ bộ nhớ nếu bộ nhớ bền trở thành nút thắt lặp lại

Các role này được cố ý defer để team không phình quá sớm.

## Điều Mình Khuyên Làm Tiếp

Bước vận hành tiếp theo mình khuyên:

- chạy T2 và T3 trong lúc vẫn tiếp tục nhịp giao hàng bình thường theo roadmap

Nói đơn giản:

- tiếp tục xây dựng roadmap đã được duyệt
- dùng các hồ sơ chuyên trách mới trên những phần việc thật
- đánh giá chúng bằng việc chúng có giảm gánh điều phối cho bạn và cải thiện đầu ra hay không

## Bạn Cần Quyết Định Gì

Chưa cần gì ngay lúc này.

Nếu về sau cần một quyết định tiếp theo, điểm hữu ích nhất sẽ là:

- giữ `kimo` ở vai trò reviewer thử nghiệm
- hay nâng vai trò đó vào nhóm nòng cốt chính thức sau thêm một vài lần rà soát UI có giá trị thật
