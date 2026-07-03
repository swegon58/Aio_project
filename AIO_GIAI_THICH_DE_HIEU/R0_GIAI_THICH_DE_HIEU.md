# R0 — Giải thích dễ hiểu cho chủ nhân

> Tài liệu này giải thích **bằng ngôn ngữ đời thường** xem R0 dùng để làm gì,
> tại sao nó phải làm trước, và sau khi xong thì Aio được lợi gì. Đây là phần
> “dọn nền”, chưa phải phần hào nhoáng người dùng nhìn thấy.

## Bức tranh lớn: trước khi xây nhà phải dọn đất

Trước R0, Aio có thể chạy được vài thứ hay ho, nhưng có một vấn đề quen thuộc:

- test chưa đủ chắc
- môi trường production có chỗ có thể cấu hình sai
- bảo mật và secret-scan chưa thật sự yên tâm
- CI/CD chưa thành một “cửa gác” đáng tin

**Mục tiêu R0:** biến repo và đường đi ra production thành một nơi **an toàn để
làm việc tiếp**. Nó không làm Aio thông minh hơn, nhưng làm tụi mình bớt tự
đâm vào chân khi phát triển nhanh.

---

## So sánh: trước R0 vs sau R0

| Tình huống | Trước R0 | Sau R0 |
|---|---|---|
| Push code mới | Có thể vô tình làm vỡ thứ khác | CI chặn sớm |
| Cấu hình production sai | Có thể chỉ phát hiện khi deploy | Fail sớm, không cho chạy |
| Secret lộ trong repo | Dễ bị bỏ sót | Có quét và có quy trình xử lý |
| Migrations database | Có thể không kiểm kỹ | Có bước verify rõ ràng |
| Agent khác vào repo | Dễ rối | Có nền tảng đáng tin hơn để tiếp tục |

---

## R0 thực chất xây gì

### 1. Bộ cổng kiểm tra tự động
Mỗi lần có thay đổi, hệ thống phải tự hỏi:

- code có lint sạch không?
- type có đúng không?
- test có pass không?
- build production có pass không?
- migration có apply được không?

**Dễ hiểu:** giống như mỗi lần chuẩn bị ra đường, Aio phải đi qua một cánh cổng
soát vé. Vé không hợp lệ thì không được lên tàu.

### 2. Khóa những đường tắt nguy hiểm trong production
Có những thứ tiện cho dev local nhưng cực nguy hiểm nếu lọt lên production, ví dụ:

- bypass auth
- fallback billing kiểu dev
- key runtime kiểu tạm bợ

R0 làm cho production **thà không chạy còn hơn chạy sai**.

### 3. Dọn chuyện secret và bảo mật cơ bản
R0 không giải quyết mọi bài toán bảo mật, nhưng nó làm cái tối thiểu bắt buộc:

- quét các secret dễ lộ
- chặn lỗi cấu hình cơ bản
- ghi rõ những gì đã xử lý và những gì không được phép làm bừa

### 4. Đo baseline
Muốn sau này biết Aio tốt hơn hay tệ đi, phải biết hôm nay nó đang ở đâu:

- chat nhanh cỡ nào
- research có chạy ổn không
- image generation mất bao lâu

R0 giúp tụi mình có một “mốc chuẩn”.

---

## Người dùng có cảm nhận được R0 không?

Thường là **không thấy trực tiếp**. Nhưng người dùng sẽ cảm nhận gián tiếp:

- ít bug ngớ ngẩn hơn
- ít trường hợp “local chạy được mà production chết”
- ít lần app hỏng sau khi update

R0 giống như:

- siết ốc
- thử phanh
- kiểm xăng

trước khi chạy xe đường dài.

---

## Vì sao R0 phải đứng trước mọi phase khác

Nếu không có R0:

- R1 làm durability nhưng khó kiểm là có thật bền không
- R4 làm Deep Research nhưng mỗi lần sửa có thể phá chỗ khác
- R6 chuẩn bị private beta nhưng nền vận hành chưa đáng tin

Nói ngắn gọn: **R0 không tạo giá trị trực tiếp cho người dùng, nhưng nó bảo vệ
mọi giá trị sẽ được xây sau này.**
