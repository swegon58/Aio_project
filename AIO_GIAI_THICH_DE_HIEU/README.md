# Aio — Bộ giải thích dễ hiểu cho chủ nhân

> Bộ này là bản **giải thích bằng ngôn ngữ đời thường** cho toàn bộ roadmap của
> Aio từ `R0` đến `R7`. Nó không thay thế tài liệu kỹ thuật. Nó giúp chủ nhân
> nhìn nhanh: giai đoạn đó làm gì, tại sao phải làm, người dùng sẽ cảm thấy gì,
> và nó mở đường cho bước sau ra sao.

## Đọc thế nào cho dễ nhất

Nếu muốn hiểu toàn cảnh rất nhanh:

1. Đọc file này trước.
2. Đọc `R1`, `R4`, `R6` trước vì đây là ba trục lớn nhất của Aio:
   - `R1`: làm Aio bền vững
   - `R4`: làm Deep Research thật sự đáng dùng
   - `R6`: biến Aio thành sản phẩm beta có thể mời người dùng thật
3. Sau đó đọc `R2`, `R3`, `R5`, `R7`.

## Danh sách file

- `R0_GIAI_THICH_DE_HIEU.md`
- `R1_GIAI_THICH_DE_HIEU.md`
- `R2_GIAI_THICH_DE_HIEU.md`
- `R3_GIAI_THICH_DE_HIEU.md`
- `R4_GIAI_THICH_DE_HIEU.md`
- `R5_GIAI_THICH_DE_HIEU.md`
- `R6_GIAI_THICH_DE_HIEU.md`
- `R7_GIAI_THICH_DE_HIEU.md`

## 1 câu cho mỗi giai đoạn

### R0 — Dọn sân và khóa cửa
Làm cho repo, CI, production safety, test, bảo mật cơ bản trở nên sạch sẽ để
mọi phase sau không xây trên nền lung lay.

### R1 — Làm mỗi lượt chạy của Aio trở nên bền vững
Refresh tab, mất mạng, backend khởi động lại cũng không làm mất lượt đang chạy.

### R2 — Làm công cụ và phê duyệt trở nên có kiểm soát
Việc nguy hiểm phải xin phép, được ghi lại, và không thể “lỡ tay chạy hai lần”.

### R3 — Làm Aio tự kể được nó đang khỏe hay đau ở đâu
Biết vì sao run hỏng, chậm, hoặc đắt trước khi người dùng nổi giận.

### R4 — Biến Deep Research và Knowledge thành tính năng flag ship thật sự
Không chỉ “có nghiên cứu”, mà là nghiên cứu có nguồn, có tiến trình, có chất lượng.

### R5 — Đưa việc dài hơi ra hậu trường
Những việc nặng hoặc chạy theo lịch không còn phụ thuộc vào tab trình duyệt.

### R6 — Sẵn sàng cho private beta có người dùng thật
Onboarding, billing, quyền riêng tư, vận hành, support, đo lường.

### R7 — Chỉ mở rộng khi có bằng chứng
Không thêm phức tạp chỉ vì “nghe hay”; chỉ làm khi số liệu và hành vi người dùng chứng minh là đáng.

## Bức tranh lớn: Aio đang đi theo hướng nào

Aio không phải công cụ cho dev/op. Nó đang đi theo hướng:

- một trợ lý AI cho người dùng cuối
- làm việc dài hơi nhưng vẫn dễ hiểu
- có thể chat, nghiên cứu, tạo ảnh, dùng công cụ
- dần dần trở thành một “workspace biết làm việc”

Điều đó có nghĩa: roadmap này không ưu tiên khoe kỹ thuật. Nó ưu tiên:

- độ tin cậy
- khả năng quay lại tiếp tục việc đang dở
- minh bạch vừa đủ để người dùng yên tâm
- tính năng tạo giá trị rõ ràng
- khả năng thu tiền một cách tử tế

## Nếu sau này nói với agent khác: “tiếp tục build Aio”

Agent nên đọc theo thứ tự:

1. `AIO_PROJECT_STATE.md`
2. `AIO_MASTER_EXECUTION_PLAN.md`
3. Bộ file trong folder này để hiểu ý đồ sản phẩm bằng tiếng người
4. Checklist phase đang làm

Folder này được đặt ở root cho dễ thấy và đã được thêm vào `.gitignore`, nên nó
phục vụ việc làm sản phẩm và onboarding tác nhân khác, không làm rối lịch sử Git.
