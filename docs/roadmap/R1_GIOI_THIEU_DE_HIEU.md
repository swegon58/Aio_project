# R1 — Giải thích dễ hiểu cho chủ nhân

> Tài liệu này giải thích **bằng lời ăn tiếng nói** xem tụi mình sắp xây gì ở giai
> đoạn R1, mỗi thứ dùng để làm gì, và tại sao nó quan trọng. Không có thuật ngữ
> kỹ thuật rườm rà. (Bản chính thức, chi tiết kỹ thuật nằm ở
> `R1_EXECUTION_CHECKLIST.md` và `ADR-001`.)

## Bức tranh lớn: Aio đang ở đâu

Aio hiện tại đã là một trợ lý chạy được: mình chat, nó trả lời, nó có thể gọi
công cụ, xin phê duyệt, tạo ảnh, làm nghiên cứu. Nhưng mỗi "lượt làm việc" của
Aio giống như một **cuộc gọi đang nói dở** — nếu mình tắt tab, refresh trang,
hoặc mất mạng giữa chừng thì **mọi thứ biến mất hết**. Lượt đó không được lưu,
không xem lại được, không nối lại được.

**Mục tiêu R1:** làm cho mỗi lượt làm việc của Aio trở nên **bền vững** — giống
như một email hay một đơn hàng: nó được lưu lại, mình có thể quay lại xem bất cứ
lúc nào, và nếu mạng giật thì nó tự nối lại chứ không mất.

---

## So sánh: trước R1 vs sau R1

| Tình huống | Trước R1 | Sau R1 |
|---|---|---|
| Refresh trang giữa lúc Aio đang chạy | Mất trắng, phải chat lại | Aio vẫn chạy ngầm, vào lại là thấy tiếp |
| Mất mạng vài giây | Stream đứt, không biết nó làm tới đâu | Tự nối lại, không thiếu event nào |
| Backend khởi động lại | Lượt đang chạy coi như hỏng | Lượt vẫn còn, xem lại được |
| Muốn xem lại lượt cũ | Không xem được | Xem lại toàn bộ như xem lại một đoạn chat |
| Bấm "dừng" rồi bấm lại | Có thể lỗi | Không sao, nó hiểu là cùng một lệnh dừng |

Nói ngắn gọn: **R1 biến mỗi lượt làm việc từ "hơi thở" thành "tài liệu"** — có
tên, có thứ tự, có trạng thái, có thể lưu và mở lại.

---

## 7 thứ tụi mình sẽ xây (R1.1 → R1.7)

### R1.1 — Bản quy định về "lượt làm việc" (ADR) ✅ Đã xong
**Công dụng:** trước khi xây, mình cần thống nhất "một lượt làm việc" nghĩa là
gì, nó có những trạng thái nào (đang chờ → đang chạy → đang chờ mình duyệt →
xong/hỏng/đã hủy), và ai là người "sở hữu" cái tên của lượt đó (Aio, chứ không
phải bộ não Hermes ở dưới).

**Dễ hiểu:** giống như trước khi xây nhà phải có bản vẽ quy định phòng nào làm
gì. R1.1 chính là bản vẽ đó. Đã viết xong.

---

### R1.2 — Cái "phong bì" chuẩn cho mọi sự kiện
**Công dụng:** hiện tại khi Aio làm việc, nó thả ra từng mẩu tin nhắn lộn xộn
(không có số thứ tự, không có tem, không có người gửi rõ ràng). R1.2 cho mỗi
mẩu tin nhắn một **phong bì chuẩn**: có mã, có số thứ tự, có ngày giờ, có nhãn
nói nó từ đâu tới.

**Dễ hiểu:** giống như chuyển từ đống thư rác thành **một xấp thư được đánh số
thứ tự, đóng tem, ghi rõ ngày nhận**. Nhờ vậy mình biết chắc: thư nào đến trước,
thư nào đến sau, không bị trùng, không bị mất. Và nếu có thư lạ (Aio không nhận
ra) thì nó được cất vào ngăn "chưa rõ" chứ không bị vứt đi im lặng như bây giờ.

---

### R1.3 — Cái két sắt lưu trữ (cơ sở dữ liệu)
**Công dụng:** xây 2 "ngăn kéo" trong database:
- Một ngăn chứa **thông tin lượt làm việc** (của ai, đang ở trạng thái nào, tốn
  bao nhiêu credit, lỗi gì nếu có).
- Một ngăn chứa **toàn bộ các sự kiện** theo đúng thứ tự.

Mỗi người dùng chỉ được mở ngăn của chính mình (bảo mật theo người dùng).

**Dễ hiểu:** giống như Aio có một **cuốn sổ ghi chép riêng cho từng người**. Mình
vào sổ của mình thì chỉ thấy đồ của mình, không ai lén đọc được sổ người khác.

---

### R1.4 — Người thư ký chuyên ghi chép (repositories)
**Công dụng:** những hàm chuyên trách "ghi vào sổ" và "đọc từ sổ" một cách an
toàn: tạo lượt mới, thêm sự kiện (không bao giờ ghi trùng), đổi trạng thái lượt
(mà chỉ cho phép đổi hợp lệ), đánh dấu xong/hỏng, yêu cầu dừng, và mở danh sách
lượt cũ của mình.

**Dễ hiểu:** giống như thuê một **người thư ký cẩn thận**, chỉ người đó được
viết vào sổ (trình duyệt không được tự viết bừa), và người đó luôn kiểm tra
"đổi trạng thái này có hợp lý không" trước khi ghi.

---

### R1.5 — Tách "người điều phối" ra khỏi "người phát tin"
**Công dụng:** hiện tại cái route chat đang ôm đồm quá nhiều việc. R1.5 chia
thành 2 vai:
- **Người điều phối:** lo việc thật của lượt (xác thực người dùng, kiểm tra
  credit, tạo lượt, gọi bộ não Hermes, ghi chép, tính tiền).
- **Người phát tin:** chỉ lo việc truyền tin về trình duyệt.

**Tại sao quan trọng:** nếu mình tắt tab, người "phát tin" mất, **nhưng người
điều phối vẫn đang làm việc trên server**. Lượt không hỏng. Đây chính là lý do
mình refresh không mất việc.

**Dễ hiểu:** giống như tách **người đầu bếp** (điều phối, nấu ở bếp, không quan
tâm khách có đang nhìn không) ra khỏi **người bưng bê** (phát món ăn ra bàn).
Khách rời bàn rồi thì người bưng bê nghỉ, nhưng bếp vẫn nấu xong món đó.

---

### R1.6 — Các nút "xem lại" và "dừng"
**Công dụng:** thêm các đường dẫn để mình:
- Xem **danh sách lượt** cũ.
- Xem **chi tiết 1 lượt**.
- Xem lại **toàn bộ sự kiện** của 1 lượt theo thứ tự (từ điểm nào đó trở đi).
- **Dừng** 1 lượt (bấm nhiều lần cũng không sao).

**Dễ hiểu:** giống như mỗi lượt có một **trang hồ sơ riêng**: mình vào xem lại
được mọi thứ đã xảy ra, và có nút "Hủy" an toàn.

---

### R1.7 — Giao diện tự nối lại (timeline)
**Công dụng:** cập nhật phần hiển thị trên web để: khi mình vừa gửi thì hiện lượt
mới ngay; khi vào lại trang thì tự nạp lại lịch sử; trộn tin mới vào mà không bị
trùng; trạng thái chạy/chờ duyệt/xong/hỏng/đã hủy hiển thị đúng; nút "Dừng" chỉ
hiện khi dừng được.

**Dễ hiểu:** phần mặt trước sẽ **nhớ và nối lại** mọi thứ tự nhiên — mình vào
lại trang, thấy Aio vẫn đang làm đúng chỗ nó dở, y như mình chưa hề rời đi.

---

## Sau R1, người dùng sẽ cảm thấy gì

- Aio **đáng tin hơn**: tắt tab, rớt mạng, khởi động lại — không việc gì mất.
- Mình có thể **xem lại** toàn bộ những gì Aio đã làm cho mình.
- Nút **Dừng** hoạt động đúng và an toàn.
- Đây là **nền móng** cho Deep Research và các tính năng flag ship sau này — vì
  những công việc dài, phức tạp chỉ chạy được khi lượt làm việc đã bền vững.

R1 không thêm tính năng "hào nhoáng" nào cho người dùng — nó làm cho những gì đã
có **chạy được tin cậy và lâu dài**. Giống như xây móng nhà: không ai nhìn thấy,
nhưng không có nó thì không xây tầng trên được.
