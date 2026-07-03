# R2 — Giải thích dễ hiểu cho chủ nhân

> R2 là phase làm cho việc dùng công cụ của Aio trở nên **có kỷ luật**. Nó trả
> lời câu hỏi: “Aio được phép làm gì, khi nào phải xin mình, và nếu đã xin rồi
> thì làm sao để mọi thứ minh bạch, không chạy bậy, không lặp lại”.

## Bức tranh lớn: Aio càng mạnh thì càng phải có phanh

Khi Aio chỉ chat trả lời, rủi ro thấp.
Nhưng khi nó có thể:

- gửi email
- sửa file
- gọi API bên ngoài
- chạy lệnh
- chạm vào dữ liệu

thì câu chuyện đổi khác. Lúc này người dùng cần:

- biết Aio định làm gì
- có quyền chặn lại
- có lịch sử để xem sau

**Mục tiêu R2:** biến mọi hành động nhạy cảm thành thứ:

- có manifest
- có risk level
- có approval khi cần
- có audit log
- không thể “chạy lặp vô tình”

---

## So sánh: trước R2 vs sau R2

| Tình huống | Trước R2 | Sau R2 |
|---|---|---|
| Tool nguy hiểm sắp chạy | Dễ mơ hồ | Có risk + policy |
| Approval | Mang tính runtime, hơi mong manh | Bền vững, có thể xem lại |
| Bấm approve hai lần | Có thể rối | Idempotent |
| Muốn biết Aio đã đụng gì | Khó lần | Có audit trail |
| MCP / external tools | Dễ thành vùng xám | Có boundary và allowlist |

---

## R2 xây gì

### 1. Danh bạ công cụ
Mỗi tool sẽ có một “hồ sơ nhân sự”:

- tên
- loại
- có đọc hay ghi
- có đụng mạng không
- mức nguy hiểm
- có cần approval không

**Dễ hiểu:** trước khi cho ai vào làm việc, phải biết họ được giao quyền gì.

### 2. Lưu lại từng lần gọi tool
Không chỉ biết “Aio đã dùng tool”, mà biết:

- tool nào
- lúc nào
- input/output đã được redaction
- trạng thái đến đâu
- lỗi gì

### 3. Approval trở thành đối tượng thật
Approval không còn là cái hộp thoại sống vài giây.
Nó trở thành một bản ghi bền vững:

- ai xin
- xin cái gì
- cho bao lâu
- ai duyệt
- duyệt kiểu nào

### 4. UI approval gọn mà rõ
Người dùng không nên thấy một mớ JSON.
Người dùng chỉ cần hiểu:

- Aio sắp làm gì
- nguy hiểm ra sao
- approve once hay deny

### 5. Luật bắt buộc approval
Một số việc luôn phải xin:

- gửi ra ngoài
- phá hủy dữ liệu
- mua/chi tiền
- shell hoặc infra mutation

### 6. Audit log và ranh giới MCP
Khi có sự cố, tụi mình phải nhìn lại được chuỗi sự kiện:

- yêu cầu tool
- approval
- thực thi
- kết quả

MCP cũng phải được quản:

- allowlist
- sandbox
- audit

---

## Sau R2, người dùng cảm thấy gì

- bớt sợ Aio “làm quá tay”
- thấy mình vẫn là người cầm lái các hành động nhạy cảm
- có niềm tin hơn để giao việc thật

R2 là phase làm Aio **an tâm để dùng**, chứ không chỉ “hay để demo”.
