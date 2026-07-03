# R3 — Giải thích dễ hiểu cho chủ nhân

> R3 là phase giúp tụi mình **thấy được bên trong Aio đang xảy ra chuyện gì**
> mà không cần đoán mò. Nếu R1 là làm Aio bền, thì R3 là làm Aio biết tự kể
> bệnh sử của nó.

## Bức tranh lớn: có sản phẩm mà không đo là đang lái xe bịt mắt

Nếu không có observability, khi Aio gặp chuyện sẽ rất khó trả lời:

- nó hỏng ở đâu?
- chậm ở khâu nào?
- model nào đang đắt bất thường?
- approval nào đang làm kẹt run?

**Mục tiêu R3:** khiến mỗi run có thể bị truy ngược nguyên nhân, chi phí, độ trễ,
và độ tin cậy.

---

## So sánh: trước R3 vs sau R3

| Câu hỏi | Trước R3 | Sau R3 |
|---|---|---|
| Vì sao run fail? | Mò log rất mệt | Có trace và reason |
| Vì sao response chậm? | Đoán | Có latency breakdown |
| Tại sao tháng này tốn tiền? | Mù mờ | Có cost theo run |
| Phase nào đang gây pain? | Cảm tính | Có metric và SLO |
| Update model rồi có tốt hơn không? | Khó biết | Có golden eval |

---

## R3 xây gì

### 1. Luật telemetry
Trước khi đo, phải quyết định:

- đo cái gì
- giữ bao lâu
- cái gì là dữ liệu nhạy cảm không được bắn lung tung

### 2. Gắn “dây chỉ đỏ” xuyên suốt một run
Mọi nơi đều gắn cùng bối cảnh:

- request id
- user id
- run id
- tool call id
- provider request id

**Dễ hiểu:** như dán cùng một mã vận đơn lên mọi gói hàng trong chuỗi vận chuyển.

### 3. Đo từng chặng quan trọng
Ví dụ:

- auth/context
- start Hermes
- tool calls
- approvals
- model calls
- research stages
- image generation
- billing

### 4. Đặt SLO
Phải định nghĩa rõ:

- chậm thế nào thì là chậm
- fail rate bao nhiêu thì đáng báo động
- first visible response bao nhiêu là ổn

### 5. Có view nội bộ cho reliability và cost
Không phải dashboard cho user cuối.
Mà là bảng cho đội làm sản phẩm biết:

- cái gì hay fail
- cái gì tốn tiền
- cái gì chậm

### 6. Có bộ đề thi chuẩn
Mỗi lần đổi model, prompt, flow:

- test planning
- test research
- test knowledge grounding
- test risky tool approval

Để biết Aio đang tiến bộ hay lùi.

### 7. Có runbook
Khi sự cố xảy ra, không ngồi ngó nhau.
Phải có “nếu X thì làm Y”.

---

## Sau R3, người dùng có lợi gì

Người dùng có thể không thấy R3 trực tiếp, nhưng họ sẽ thấy:

- Aio ổn định hơn
- bug được sửa nhanh hơn
- provider lỗi thì phản ứng nhanh hơn
- chi phí và trải nghiệm bớt trồi sụt vô lý

R3 biến Aio từ “một thứ đang chạy” thành “một hệ thống có thể vận hành nghiêm túc”.
