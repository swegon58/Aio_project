# R12 — Giải thích dễ hiểu cho chủ nhân

> R12 là phase **đánh bóng UI + dọn nhà code**. Không thêm tính năng lớn, mà làm
> cho sản phẩm nhìn pro hơn, dùng mượt hơn (đặc biệt trên mobile), và mã nguồn
> AppHome khổng lồ được cắt nhỏ ra để dễ sửa.

## Bức tranh lớn: R11 cho biết UI đang 6.5/10, R12 là phase kéo lên

Audit R11 nói thẳng: giao diện còn nhiều chỗ thô — branding lộn xộn, mobile
chật, thanh cuộn xấu, card ảnh lệch, chi phí hiện nhỏ xíu.
Đồng thời file AppHome.tsx đã phình tới ~4000 dòng, sửa gì cũng sợ đụng.

**Mục tiêu R12:** **đẹp hơn, mượt hơn, và code gọn hơn** — để các phase sau sửa
nhanh và người dùng thấy khác biệt ngay.

---

## R12 làm gì

### 1. Bỏ branding/giãn cách thừa
Bỏ chữ "Workspace", logo "Aio" thừa trong panel, tab "Model Providers" không
cần. Bề mặt sạch hơn, tập trung vào việc đang làm.

### 2. Mobile tử tế
Nút "New Chat" full-width và giữa, thanh cuộn textarea không lấn, hover/sidebar
đúng chỗ. Aio dùng được trên điện thoại, không chỉ desktop.

### 3. Đánh bóng chi tiết
Glass blur cho bong bóng agent, card ảnh đúng tỉ lệ khung hình, hiển thị credits
lên thành nút rõ ràng, bỏ khung "Auto" bị cắt.

### 4. Cắt AppHome.tsx ra hook + context + section riêng (xong 2026-07-06)
File ~4000 dòng được tách hoàn toàn: 11 hook nhỏ (`useCredentials`,
`useConnections`, `useNotifications`, `useAccountPrefs`, `useWorkspacePanel`,
`useImageGeneration`, `useRunTimeline`, `useChatComposer`…), 3 React context
theo tần suất cập nhật (chat nóng / workspace ấm / tài khoản nguội), và JSX
tách thành từng khối màn hình riêng (sidebar, composer, danh sách tin nhắn,
panel phải, modal). `AppHome.tsx` giờ chỉ còn là "khung lắp ráp" ~1300 dòng,
không còn logic dồn hết một chỗ.

---

## Trạng thái hiện tại

Phần **cắt code AppHome đã xong hoàn toàn** (nhánh `feat/r12-fixes`, commit gần
nhất `5e10f45`) — hook, context, và tất cả khối màn hình đều đã tách, đã chạy
qua typecheck/lint/264 unit test/Playwright (desktop xanh hết; 10 ca lỗi
mobile-chromium là lỗi cũ từ trước, không liên quan). Phần đánh bóng UI (bỏ
branding, mobile, glass blur…) phần lớn cũng đã xuống. R12 **vẫn chưa chốt
chính thức thành "phase" có checklist riêng** trong `docs/roadmap/` và **chưa
merge vào `main`**.

Cùng thời gian này có **nghiên cứu open-webui** (xem có mẫu nào đáng học không)
— kết luận: học vài mẫu RAG/tool, **không** thay app. Ba món học được (trích
nguồn `[N]`, tìm kiếm lai BM25+vector, Valves chỉnh tool trong Settings) đã
code xong local, đang chờ chủ nhân duyệt merge/push (xem
`OWNER_PENDING_OPENWEBUI.md`).

---

## Sau R12 (khi xong), Aio khác gì

- nhìn pro, dùng mượt trên cả desktop lẫn mobile
- code gọn, phase sau sửa nhanh hơn, ít rủi ro regress
- sẵn sàng cho các cải thiện chất lượng (a11y, graceful degradation) ở giai đoạn
  hardening sau

R12 là phase **làm cho sản phẩm tự tin hơn khi người thật nhìn vào**.
