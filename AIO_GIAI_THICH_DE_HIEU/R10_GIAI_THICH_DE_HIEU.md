# R10 — Giải thích dễ hiểu cho chủ nhân

> R10 là phase **dừng lại để nhìn lại**. Không thêm nhiều tính năng, mà ngồi
> audit sản phẩm thật, chốt hướng đi, và đặt vài nền móng nhỏ (notify, Google
> OAuth) cho các phase sau.

## Bức tranh lớn: cám dỗ lớn thứ hai (sau R7) là chạy tiếp

Sau khi có Deep Research và backend ổn, ngu reflex là "thêm feature, thêm
feature". R10 làm ngược lại: **hỏi thẳng "sản phẩm đã sẵn sàng cho người thật
chưa, và nếu chưa thì thiếu gì?"**

**Mục tiêu R10:** biết rõ Aio đang đứng ở đâu, thiếu gì, và mở cửa kiểu nào
(invite-only alpha) là an toàn.

---

## R10 làm gì

### 1. Audit sẵn sàng sản phẩm (product-readiness)
Nhiều agent chuyên dụng cùng rà sản phẩm, tổng hợp ra ~12 gap cần xử lý.
Kết quả là một bản kế hoạch cứng (PRODUCT_READY_MASTER_PLAN) chia thành 5 giai
đoạn: tin cậy → tuân thủ → độ sâu UX → đo lường → sắp xếp lại.

### 2. Chốt hướng: harden trước, marketing sau
Quyết định (2026-07-02): **chắc trước, mở sau**. Chưa làm landing page PR,
chưa i18n, chưa mở rộng market. Tập trung làm cho sản phẩm chắc.

### 3. Đặt nền notify
Migration + API + giao diện thông báo (chuông, badge, toggle Discord).
Người dùng bắt đầu có kênh nhận kết quả/thay đổi.

### 4. Đặt nền Google OAuth
Kết nối Google (bắt đầu với Calendar) qua OAuth đúng chuẩn, token lưu trong
vault, refresh tự động. Mở đường cho các kết nối Google sau (Drive, Gmail) —
nhưng Gmail/Drive còn chờ cổng tuân thủ (CASA).

### 5. Quyết định grill → invite-only alpha
Chốt luồng: mời từng người vào alpha có kiểm soát, không mở công khai.

---

## Sau R10, Aio khác gì

- có bản kế hoạch cứng để xử lý gap, thay vì làm theo cảm tính
- có nền notify + Google connect để R11 và sau dùng
- biết rõ: đang ở chế độ "chắc trước", không "phóng lên"

R10 là phase **của sự tỉnh táo chiến lược**, không phải của số lượng tính năng.
