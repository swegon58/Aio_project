# R6 — Giải thích dễ hiểu cho chủ nhân

> R6 là phase biến Aio từ “một sản phẩm đang build rất nghiêm túc” thành “một
> sản phẩm có thể mời người dùng thật vào dùng thử và trả tiền”. Đây là phase
> thương mại hóa và vận hành tử tế.

## Bức tranh lớn: làm được chưa đủ, phải mời người thật vào được

Đến trước R6, Aio có thể đã:

- bền hơn
- có research tốt hơn
- có queue/worker
- có observability

Nhưng để mời người dùng thật vào, vẫn còn câu hỏi khó:

- onboarding có ổn không?
- billing có đúng không?
- quyền riêng tư và data control ra sao?
- support và incident xử lý thế nào?

**Mục tiêu R6:** làm cho Aio **đủ chín để private beta có người dùng thật**.

---

## So sánh: trước R6 vs sau R6

| Tình huống | Trước R6 | Sau R6 |
|---|---|---|
| User mới vào | Có thể hơi rối | Có onboarding rõ |
| Charge / credits | Có thể chưa khép kín | Có ledger và webhook an toàn |
| Muốn xóa dữ liệu | Chưa đủ rõ | Có control cụ thể |
| Production incident | Dễ ứng biến | Có runbook, backup, rollback |
| Theo dõi beta | Cảm tính | Có analytics và gates |

---

## R6 xây gì

### 1. Onboarding tử tế
Người dùng mới cần:

- hiểu sản phẩm này làm gì
- cài được vài personalization cơ bản
- thấy ví dụ dùng ngay trong composer

Không phải landing page đẹp là xong.
Phải vào là dùng được.

### 2. Audit auth và tenant security
Khi có người dùng thật, lỗi tenant leak là tai nạn lớn.
R6 cần rà:

- session paths
- RLS
- CSRF/origin
- rate limits
- account deletion/export

### 3. Billing và credits nghiêm túc
Đây là một phần cực nhạy:

- checkout
- subscription mapping
- webhook signature
- idempotent storage
- reconciliation
- refunds / chargeback

Và phải có ledger append-only cho:

- cấp credit
- reserve
- settle
- refund

### 4. Usage và plan UX
Người dùng cần thấy:

- plan hiện tại
- credits còn bao nhiêu
- reset khi nào
- task này có vẻ sẽ tốn hơn bình thường không

### 5. Privacy, legal, data controls
Tới beta thì không thể “để sau tính”.
Cần:

- privacy policy
- terms
- acceptable use
- retention policy
- export/delete controls

### 6. Deployment và operations
Không chỉ deploy được.
Phải có:

- secrets tử tế
- preview/prod environment
- post-deploy smoke
- rollback
- backup restore test
- incident contact

### 7. Beta analytics
Muốn biết beta có hứa hẹn hay không, phải đo:

- activation
- retention
- successful runs per user
- cost per success
- top failure categories

### 8. Beta gate
Trước khi mở cửa phải check đủ:

- onboarding pass
- billing pass
- tenant security pass
- data deletion/export pass
- legal reviewed
- backup restore tested

---

## Sau R6, người dùng cảm thấy gì

- Aio bớt giống project cá nhân, giống sản phẩm thật hơn
- việc trả tiền và dùng quota minh bạch hơn
- niềm tin về dữ liệu và độ nghiêm túc cao hơn

R6 là phase biến “có thể dùng” thành “có thể mời người thật vào dùng”.
