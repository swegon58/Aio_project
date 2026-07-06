# R8 — Giải thích dễ hiểu cho chủ nhân

> R8 là phase dạy phần **sau sân khấu** của Aio chạy tử tế ở quy mô nhiều người
> dùng: backend đáng tin, biết tự kể sức khỏe, tách provider theo từng khách
> hàng, và tách bọt các bot ra khỏi nhau.

## Bức tranh lớn: trước R8, Aio chạy được, nhưng "chạy được" chưa đủ

Đến trước R8, Aio đã bền, đã có research, đã có queue.
Nhưng vài thứ vẫn hơi "project cá nhân":

- mỗi lượt chạy dùng chung key provider → khó kiểm chi phí từng người
- khi run hỏng, đôi khi phải đoán原因
- bot Discord của Aio và bot khác còn dùng chung đường, dễ lẫn
- lỗi người dùng thấy đôi khi thô

**Mục tiêu R8:** làm cho **phần vận hành bên trong** đủ chín để không phải
lo khi có nhiều người dùng cùng chạy.

---

## R8 xây gì

### 1. Cung cấp key OpenRouter riêng cho từng khách hàng
Mỗi người dùng có provisioning key riêng, có trần chi tiêu.
Nghĩa là: chi phí của người này không trộm của người kia, và dễ đối soát.

### 2. Gộp backend cũ lại cho gọn
Backend rời rạc được gom về một chỗ rõ ràng, bớt mã chết, bớt chỗ dễ nhầm.

### 3. Stack quan sát (observability)
Bắt đầu gắn Langfuse + OpenTelemetry để mỗi lượt chạy có trace.
Aio bắt đầu biết "lượt này chậm ở bước nào" thay vì đoán mò.

### 4. EmbeddingProvider
Đường dẫn embedding (phục vụ Knowledge/Research) có provider rõ ràng, dễ đổi.

### 5. Trang lỗi tử tế + Scheduled Tasks UI
Khi có lỗi, người dùng thấy trang dễ hiểu thay vì текст thô.
Và có giao diện xem/nặn các task chạy theo lịch.

### 6. Tách bot Discord ra riêng
Bot của Aio và bot khác được cô lập: socket riêng, hook riêng, không lẫn nhau.

---

## Sau R8, Aio khác gì

- chi phí tách theo người, đối soát được
- khi hỏng, có dấu vết để溯源
- bot không còn lẫn
- nền tảng vững hơn để R9 gánh Deep Research nặng hơn

R8 là phase **làm cho phần trong ruột xứng đáng với phần ngoài bề mặt**.
