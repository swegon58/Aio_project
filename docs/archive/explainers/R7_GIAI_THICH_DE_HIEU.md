# R7 — Giải thích dễ hiểu cho chủ nhân

> R7 không phải phase “thêm nhiều thứ cho vui”. Ngược lại, nó là phase dạy Aio
> một thói quen rất quan trọng: **chỉ phức tạp lên khi có bằng chứng là đáng**.

## Bức tranh lớn: sau beta, cám dỗ lớn nhất là ôm đồm

Sau khi có người dùng thật, thường sẽ có vô số ý tưởng:

- saved agents
- workflow builder
- multi-agent teams
- vector DB khác
- browser provider khác
- multimodal expansion

Ý tưởng nào nghe cũng hay.
Nhưng nếu cái gì cũng làm:

- sản phẩm loãng
- đội dev bị kéo tứ phía
- chi phí và complexity tăng nhanh

**Mục tiêu R7:** biến việc mở rộng thành một quá trình có kỷ luật.

---

## Luật của R7

Không feature nào được bắt đầu chỉ vì:

- “bên kia có”
- “nghe ngầu”
- “có thể sau này sẽ hữu ích”

Mỗi feature phải có ít nhất:

- bằng chứng người dùng đang cần
- metric nó định cải thiện
- chi phí
- rủi ro
- cách rollback

---

## Những hướng mở rộng có thể xảy ra

### 1. Saved Agents
Chỉ làm khi thấy người dùng lặp đi lặp lại việc custom cùng một kiểu.

**Ý nghĩa:** tiết kiệm công setup lặp lại.

### 2. Visual Workflow Builder
Chỉ làm khi rõ ràng nhiều người đang muốn chuỗi bước lặp lại mà chat thường không đủ.

**Ý nghĩa:** chuyển từ “hỏi từng lần” sang “đóng gói quy trình”.

### 3. Internal Specialist Agents
Chỉ làm khi dữ liệu chứng minh một agent chung không còn đủ tốt cho vài mảng tách biệt.

**Ý nghĩa:** tăng chất lượng bằng chuyên môn hóa, nhưng không đẩy complexity lên mặt người dùng quá sớm.

### 4. Qdrant hoặc vector store khác
Chỉ đổi khi pgvector thực sự thành nút thắt cổ chai hoặc chất lượng retrieval không đủ.

**Ý nghĩa:** tối ưu vì dữ liệu, không vì mốt.

### 5. Browser provider production-grade
Chỉ nâng cấp khi browser workflows chứng minh có nhu cầu lớn và local setup không còn đủ.

### 6. Multimodal expansion
Image đã có trước.
Video/audio/document generation chỉ nên mở rộng khi:

- có use case rõ
- cost guard rõ
- async lifecycle rõ
- artifact UX rõ

---

## R7 bảo vệ Aio khỏi điều gì

R7 bảo vệ Aio khỏi:

- phình to quá sớm
- trở thành một “AI buffet” không món nào thật sự xuất sắc
- tiêu tiền và thời gian vào thứ không đổi được metric cốt lõi

---

## Sau R7, sản phẩm trưởng thành hơn ở điểm nào

Không phải ở số lượng tính năng.
Mà ở **chất lượng quyết định**:

- biết nói “chưa”
- biết đợi bằng chứng
- biết ưu tiên thứ làm retention và willingness to pay tăng thật

R7 là phase của sự kỷ luật. Nó không làm roadmap ngắn đi. Nó làm roadmap **đỡ tự lừa mình**.
