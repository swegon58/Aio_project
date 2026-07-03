# R4 — Giải thích dễ hiểu cho chủ nhân

> R4 là phase biến Deep Research và Knowledge từ “có vẻ hay” thành **tính năng
> đáng quay lại dùng và đáng trả tiền**. Đây là một trong những phase quan trọng
> nhất cho hướng đi sản phẩm của Aio.

## Bức tranh lớn: research không được chỉ là đi search rồi tóm tắt

Muốn Deep Research thật sự có giá trị, nó phải làm được nhiều hơn:

- có plan
- có tiến trình
- có nguồn
- có cách kiểm chứng
- có report quay lại đọc được

Knowledge cũng vậy:

- upload file không đủ
- phải parse, chunk, embed, index
- phải tìm lại đúng và trích nguồn được

**Mục tiêu R4:** làm cho Aio có thể nghiên cứu và dùng tri thức theo cách mà
người dùng tin được, quay lại được, và thấy rõ giá trị.

---

## So sánh: trước R4 vs sau R4

| Tình huống | Trước R4 | Sau R4 |
|---|---|---|
| Nghiên cứu dài | Có thể làm nhưng mong manh | Có lifecycle rõ ràng |
| Muốn biết Aio lấy nguồn ở đâu | Chưa đủ chắc | Có citation và sources |
| Refresh giữa lúc research | Dễ mất bối cảnh | Có replay |
| Upload knowledge | Mới là bước đầu | Có pipeline hoàn chỉnh |
| Muốn xóa knowledge | Có thể chưa sạch | Xóa cả derived data |

---

## R4 xây gì

### 1. Hợp đồng sản phẩm cho Research
Phải nói rõ:

- câu hỏi kiểu nào hỗ trợ tốt
- output mong đợi là gì
- yêu cầu citation mức nào
- timeout/cost/search limit ra sao

### 2. Dữ liệu durable cho research
Một run research không chỉ là text trả lời.
Nó có:

- nguồn
- claim
- mapping claim -> source
- artifact/report

### 3. Orchestration theo stage
Research không còn là một khối đen.
Nó đi qua các stage như:

- hiểu đề
- lên plan
- đi tìm
- đọc kỹ
- tổng hợp
- kiểm tra
- viết báo cáo

**Dễ hiểu:** giống như thấy trợ lý đang làm luận văn theo từng bước.

### 4. Workspace UI cho research
Người dùng cần thấy:

- đang ở stage nào
- đã tìm bao nhiêu nguồn
- mất bao lâu
- có thể stop không
- report cuối cùng ở đâu

### 5. Knowledge pipeline hoàn chỉnh
Upload file chỉ là điểm bắt đầu.
Phía sau phải có:

- validate
- parse
- chunk
- embed
- index
- ready / failed

### 6. Knowledge UI dễ dùng
Người dùng phải:

- upload được
- thấy file đang processing hay failed
- retry/delete được
- xem source detail được

### 7. Kiểm chất lượng
Không chỉ “chạy được”.
Phải kiểm:

- citation có map đúng không
- claim unsupported có bị phát hiện không
- retrieval fail thì Aio có nói thật không

---

## Sau R4, người dùng cảm thấy gì

- Deep Research trở thành lý do quay lại dùng Aio
- Aio không còn chỉ “nói nghe hợp lý”, mà có thể chỉ ra “tôi dựa vào cái gì”
- Knowledge không còn là kho upload cho có, mà thành nguồn nuôi trí nhớ làm việc

Nếu R1 là làm Aio bền, thì **R4 là làm Aio đáng giá**.
