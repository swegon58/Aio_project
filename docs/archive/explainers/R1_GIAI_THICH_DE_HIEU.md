# R1 — Giải thích dễ hiểu cho chủ nhân

> Tài liệu này giải thích xem **R1 làm gì cho Aio theo kiểu dễ hình dung**:
> mỗi lượt làm việc sẽ không còn mong manh như hiện tại. Đây là phase biến Aio
> từ “đang nói chuyện trực tiếp” thành “đang làm việc có hồ sơ”.

## Bức tranh lớn: Aio hiện có thể làm việc, nhưng chưa bền

Aio hiện đã có thể:

- chat
- gọi tool
- xin approval
- làm research
- tạo ảnh

Nhưng mỗi lượt làm việc vẫn giống như một cuộc gọi đang mở:

- refresh là có thể mất
- rớt mạng là khó biết nó làm tới đâu
- backend restart là dở dang

**Mục tiêu R1:** làm cho mỗi lượt chạy của Aio trở thành một **run bền vững**:

- có mã riêng
- có trạng thái rõ ràng
- có timeline sự kiện
- có thể xem lại
- có thể nối lại

---

## So sánh: trước R1 vs sau R1

| Tình huống | Trước R1 | Sau R1 |
|---|---|---|
| Refresh khi Aio đang chạy | Dễ mất trắng | Vào lại thấy tiếp |
| Mạng chập chờn | Stream đứt là rối | Tự nạp lại từ dữ liệu đã lưu |
| Muốn xem run cũ | Gần như không có | Có hồ sơ và event |
| Bấm dừng | Có thể không ổn định | Dừng idempotent, an toàn |
| Làm Deep Research dài | Mong manh | Có nền để làm lâu và nối lại |

---

## R1 xây những gì theo cách dễ hiểu

### 1. Định nghĩa “một lượt làm việc” cho ra hồn
Phải có luật rõ:

- run bắt đầu thế nào
- trạng thái nào là hợp lệ
- khi nào coi là xong
- khi nào coi là bị hủy

**Dễ hiểu:** giống như phát minh ra mẫu đơn chuẩn cho mọi công việc.

### 2. Mọi sự kiện đều có “phong bì”
Không còn các mẩu tín hiệu bay lung tung.
Mỗi event có:

- id
- số thứ tự
- thời điểm
- nguồn gốc

**Dễ hiểu:** thay vì một đống giấy nhớ, giờ là hồ sơ được đánh số trang.

### 3. Có nơi lưu run và event trong database
Mỗi người có run của mình.
Mỗi run có các event của nó.
Không người dùng nào đọc nhầm dữ liệu người khác.

### 4. Có lớp “thư ký” chỉ chuyên ghi và đọc
Trình duyệt không tự ý viết lung tung xuống DB.
Mọi thứ đi qua server-owned repository.

### 5. Tách người điều phối khỏi người phát stream
R1 tách:

- phần **làm việc thật**
- phần **phát tín hiệu ra UI**

Nên nếu UI đứt, run vẫn còn.

### 6. Có API để xem run và dừng run
Từ đây Aio có:

- danh sách run
- chi tiết run
- event replay
- stop run

### 7. Giao diện biết nối lại
Sau cùng, UI không còn “mù”.
Nó biết:

- vừa submit xong thì hiện shell tạm
- có run thật thì thay vào
- refresh thì tự nạp lại
- event mới thì gộp vào không bị trùng

---

## Sau R1, người dùng cảm thấy gì

- Aio **đáng tin hơn nhiều**
- công việc dài hơi bớt gây lo lắng
- cảm giác “nó đang thật sự làm việc cho mình”, không chỉ đang stream chữ

R1 là **móng bắt buộc** cho:

- durable approvals ở R2
- observability tử tế ở R3
- Deep Research thật sự ở R4
- background workers ở R5

Không có R1 thì những phase sau chỉ là thêm tính năng trên nền còn dễ gãy.
