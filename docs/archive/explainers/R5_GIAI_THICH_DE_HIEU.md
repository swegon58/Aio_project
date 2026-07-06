# R5 — Giải thích dễ hiểu cho chủ nhân

> R5 là phase đưa các việc dài hơi ra khỏi vòng đời của một request web. Nói
> kiểu đời thường: đây là lúc Aio học cách **làm việc hậu trường** chứ không chỉ
> làm khi mình đang mở tab nhìn nó.

## Bức tranh lớn: có những việc không nên sống cùng một request

Ví dụ:

- ingest knowledge file lớn
- research lâu
- browser task dài
- scheduled tasks
- cleanup/retention jobs

Nếu cứ nhét tất cả vào request web:

- dễ timeout
- khó retry
- refresh tab là dễ rối
- backend scale kém

**Mục tiêu R5:** có queue, có worker, có lịch chạy, có recovery.

---

## So sánh: trước R5 vs sau R5

| Tình huống | Trước R5 | Sau R5 |
|---|---|---|
| Task chạy lâu | Dễ phụ thuộc request | Chạy nền qua worker |
| Retry | Hay chắp vá | Có contract rõ |
| Scheduled task | Có nhưng chưa thật sự owned by Aio | Có lịch, state, history |
| Worker crash | Dễ rối | Có lease/recovery |
| Một job chạy hai lần | Dễ lo | Có idempotency |

---

## R5 xây gì

### 1. Chọn hàng chờ tử tế
Trước tiên phải quyết:

- Redis/BullMQ?
- Postgres-backed queue?
- managed queue?

Không chọn theo cảm tính.
Chọn theo:

- retry
- delayed jobs
- dedupe
- cost
- local dev
- TS/Python interoperability

### 2. Hợp đồng chuẩn cho job
Mỗi job có:

- job id
- loại job
- tenant/run id
- attempt
- deadline
- payload reference

### 3. Worker services
Tách các nhóm việc nền:

- knowledge ingestion
- research stages
- browser tasks
- approval expiry
- scheduled tasks
- cleanup

### 4. Scheduled Tasks đúng nghĩa
Không chỉ có nút bấm.
Phải có:

- tạo/sửa/pause/delete
- timezone
- next run
- last outcome
- execution history

### 5. Failure và recovery
Nếu job fail:

- retry bao nhiêu lần?
- khi nào dead-letter?
- có duplicate billing không?
- có duplicate external action không?

---

## Người dùng thấy gì sau R5

- Aio làm việc “như có ca đêm”
- các việc dài không còn phụ thuộc tab đang mở
- scheduled tasks đáng tin hơn
- những việc nặng sẽ bớt làm app web bị căng thẳng

R5 là lúc Aio bắt đầu mang dáng dấp của một hệ thống **biết tự vận hành phần việc nền**.
