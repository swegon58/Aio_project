# Nhật Ký Khám Phá Sản Phẩm Cho Nhà Sáng Lập

Cập nhật: 2026-06-30
Trạng thái: ghi chú định hướng sản phẩm đang làm việc, không phải checklist triển khai

## Mũi Nhọn Sản Phẩm

- Aio v1 là không gian làm việc nghiên cứu dành cho nhà sáng lập, lấy nghiên cứu làm trung tâm.
- Người dùng mục tiêu đầu tiên: nhà sáng lập kỹ thuật đi một mình / indie builder.
- Luồng công việc mũi nhọn cốt lõi: nghiên cứu -> tổng hợp -> bản ghi nhớ quyết định / báo cáo.
- Mở rộng sau khi mũi nhọn chứng minh được giá trị:
  - files/docs/repo -> bản tóm tắt để triển khai
  - trợ lý cho nhà sáng lập chủ động hơn

## Hình Dạng Sản Phẩm

- Bề mặt chính: ưu tiên không gian làm việc, không chỉ là chat.
- Gói đầu ra mặc định: bản ghi nhớ -> kế hoạch hành động -> bộ nguồn tham chiếu.
- Slides có thể bổ sung sau như một đầu ra phụ.
- Aio nên cho cảm giác chủ động, nhưng có ranh giới rõ ràng.

## Tính Chủ Động

- Mức chủ động ưu tiên: gợi ý + draft trước, mở rộng dần về sau.
- Aio có thể đề xuất lịch theo dõi tiếp, nhưng người dùng phải chủ động bật.
- Vòng chủ động đầu tiên cần tối ưu:
  - kéo lại các cuộc trao đổi quan trọng còn dang dở
  - gợi ý bước tiếp theo tốt nhất
  - chuẩn bị bản tóm tắt làm việc ngắn trước khi bắt đầu công việc sâu

## Làm Rõ Và Cổng Plan

- Công việc lớn, mơ hồ không nên nhảy thẳng vào execution.
- Aio nên chủ động đi vào luồng chặn để lập kế hoạch / hỏi làm rõ khi thiếu ràng buộc có thể làm thay đổi đáng kể kết quả.
- Hành vi ưu tiên:
  - hỏi kỹ hơn cho các tác vụ nghiên cứu lớn, ảnh hưởng cao
  - dùng luồng câu hỏi của plan mode hiện có
  - dừng sau một số ít câu hỏi chất lượng
- Sau khi làm rõ, Aio nên hiện một bản tóm tắt làm việc ngắn:
  - mục tiêu
  - giả định
  - đầu ra
  - phạm vi

## Cách Giao Kết Quả

- Nhịp giao kết quả: kết hợp.
- Aio nên cập nhật tiến độ theo những chặng có ý nghĩa.
- Aio nên tránh stream lặt nhặt ít giá trị.
- Bản giao cuối vẫn cần cảm giác chỉn chu và hoàn thiện.

## Chuẩn Chứng Cứ

- Đầu ra nghiên cứu phải tách rõ chứng cứ và suy luận.
- Độ sâu bộ nguồn tham chiếu cho v1:
  - link nguồn trực tiếp
  - đoạn trích hỗ trợ quan trọng
  - ghi chú ngắn về độ tin cậy / độ liên quan

## Định Hướng Memory

- Mục tiêu UX: Aio cho cảm giác nhớ tốt theo mặc định.
- Mục tiêu kiến trúc: bộ nhớ mạnh nhưng có kiểm soát, nguồn gốc rõ và khả năng chỉnh sửa.
- Ưu tiên về bộ nhớ:
  - chia phạm vi theo hồ sơ cá nhân + không gian làm việc
  - khi dữ kiện thay đổi thì giữ cả bản hiện tại + bản trước đó
  - có Trung tâm bộ nhớ để người dùng xem, sửa, xóa

## Khởi Động Ban Đầu Và Chế Độ

- Phần khởi động ban đầu nên ngắn, không bằng 0 nhưng cũng không nặng:
  - người dùng là ai
  - họ đang build gì
  - họ quan tâm kiểu research nào
  - họ thích kiểu output nào
- Định hướng chế độ:
  - giữ phần chọn chế độ thật nhẹ
  - các chế độ khả dĩ gồm Hỏi, Nghiên cứu, Lập kế hoạch xây dựng, Rà soát tệp
- Private beta nên đưa ra một số luồng công việc đóng gói mạnh, không phải một danh mục lớn.
- Số lượng ưu tiên: 3 luồng công việc thật mạnh.

## Tệp Và Hình Ảnh

- Làm việc với tệp cần trở thành một năng lực đáng kể, không chỉ là tệp đính kèm thụ động.
- Hướng ưu tiên cho tệp:
  - làm việc với tệp trong không gian làm việc phong phú hơn, vượt qua kiểu tải lên rồi tóm tắt đơn giản
  - hỗ trợ lượt xử lý đầu rộng cho tài liệu, bảng tính, slide, tệp repo và hình ảnh, dù điều này làm tăng phạm vi
- Tạo hình ảnh vẫn nên là một năng lực độc lập hạng nhất.
- Hướng nghiên cứu kết hợp trực quan hóa thì tạm hoãn.

## Luồng Công Việc Đóng Gói

- Số luồng công việc đóng gói ưu tiên trong private beta đầu tiên: 3.
- Bộ ưu tiên hiện tại:
  - competitor / market brief
  - decision memo
  - document / repo review brief
- Luồng vào mạnh nhất nên là competitor / market brief.
- Luồng document / repo review nên giữ cân bằng giữa trường hợp tài liệu là trung tâm và trường hợp repo là trung tâm.
- Mỗi luồng công việc cần có khung / cấu trúc đầu ra mặc định rõ ràng.
- Cách vào luồng công việc nên kết hợp:
  - thư viện mẫu / thẻ để dễ khám phá
  - nhập bằng chat cho người dùng quen gõ tự nhiên
- Khi bắt đầu luồng công việc nên điền sẵn:
  - mục tiêu
  - đầu ra kỳ vọng
  - đầu vào được gợi ý
- Kết quả luồng công việc hoàn thành nên sống ở cả:
  - cuộc trao đổi gốc
  - không gian làm việc / thư viện như đầu ra bền vững
- Không gian làm việc / thư viện nên tổ chức chủ yếu theo loại đầu ra.
- Tìm kiếm nên ưu tiên đầu ra, bộ nhớ và tệp trước lịch sử chat thô.
- Khi mở lại một đầu ra, gợi ý đầu tiên thường nên là "Tiếp tục từ đây".
- Đầu ra lớn nên mở đầu bằng phần điểm chính ngắn.
- Đầu ra nên phân biệt rõ chứng cứ mạnh, suy luận và phần chưa chắc chắn còn tồn đọng.
- Đầu ra nên xuất được ít nhất ra PDF và Markdown trong v1.
- Chứng cứ yếu hoặc kết luận mỏng phải được gắn cờ rõ ràng, không được che bằng giọng văn.
- Private beta nên thu phản hồi rất nhẹ về mức hữu ích của đầu ra.
- Hỗ trợ nên bắt đầu bằng điểm nhập phản hồi nhẹ trong sản phẩm kèm phần theo dõi của nhà sáng lập.
- Invite-only beta đầu tiên nên giữ khoảng 10-20 người dùng.
- Cách truyền đạt giá ban đầu có thể còn mềm dẻo, chưa cần mã hóa quá cứng trên trang, nhưng sản phẩm vẫn không được lộ phần chi phí vận hành nội bộ.
- Khi người dùng chạm giới hạn sử dụng hoặc giới hạn tác vụ, Aio nên giải thích rõ lý do và gợi ý một bước nhỏ hơn hoặc hợp lệ hơn.

## Kế Hoạch Hành Động

- Kế hoạch hành động nên đủ cụ thể để dẫn hướng 1-2 tuần tiếp theo.
- Không nên mặc định biến thành output quản lý dự án quá cứng.

## Quy Tắc UI Và Ngôn Ngữ Sản Phẩm

- UI cho người dùng không bao giờ được lộ chi tiết backend/provider/runtime.
- Không hiển thị tên mô hình, tên runtime thô, chi phí vận hành nội bộ, hoặc thuật ngữ triển khai trên bề mặt sản phẩm cho người dùng.
- Trạng thái hiển thị cho người dùng nên mô tả ý định hoặc kết quả, không mô tả máy móc ẩn phía sau.
- Các nút và điều khiển tương tác nên theo một mẫu hành động chung của Aio để giữ được sự đồng bộ trực quan.
- Về sau nên có một agent chuyên rà soát UI sản phẩm để thực thi các quy tắc này.

## Những Luồng Cần Quay Lại Sau

- bộ quy tắc thiết kế chính thức cho Aio
- hồ sơ agent rà soát UI sản phẩm
- benchmark kiến trúc bộ nhớ và lựa chọn triển khai
- chính sách kích hoạt plan-gate chủ động
- mẫu trực quan hóa nghiên cứu lấy cảm hứng từ các sản phẩm mạnh trên thị trường
- cách tạo hình ảnh và nghiên cứu nên kết hợp trong trải nghiệm không gian làm việc cuối cùng

## Định Hướng Team-Agent Nội Bộ

- Với team nội bộ dài hạn để xây dựng và đưa Aio ra ngoài, topology ưu tiên hiện tại là:
  - một điều phối viên chính
  - một số ít agent chuyên trách được gọi như công cụ
- Kích thước team ban đầu ưu tiên: 3-4 agent chuyên trách nòng cốt.
- Hướng chuyên môn hóa hiện tại nghiêng về quyền sở hữu theo lớp kỹ thuật hơn là theo vai trò hướng người dùng.
- Hình dạng nhóm nòng cốt ưu tiên hiện tại:
  - Frontend
  - Backend
  - Product / UX
  - QA / Reviewer
- Điều phối viên chính vẫn nên được phép sửa code trực tiếp, đặc biệt với các tác vụ cắt ngang nhiều lớp hoặc nặng về tích hợp.
- Agent QA / Reviewer có thể sửa các lỗi nhỏ, rõ ràng, nhưng vẫn phải giữ kỷ luật rà soát:
  - nêu phát hiện trước
  - ghi rõ khi chuyển từ review sang fix
  - người rà soát không được là bên duy nhất chấp nhận chính phần sửa của mình
- Agent Product / UX nên tham gia sớm ở quyết định về luồng, câu chữ và trạng thái, rồi rà lại chất lượng UI gần cuối.
- Nhịp triển khai ưu tiên:
  - backend đóng băng contract
  - frontend build theo contract
  - điều phối viên chính xử lý các điểm nối cắt ngang
- Product / UX nên sở hữu rõ ràng các quy tắc về ngôn ngữ sản phẩm an toàn cho người dùng, bao gồm quy tắc không để lộ chi tiết backend/provider trong UI.
- Điều phối viên chính nên sở hữu định nghĩa hoàn thành cuối cùng.
- Phạm vi sở hữu của Backend nên bao gồm:
  - API và service logic
  - orchestration contracts
  - persistence / repository layer
- Phạm vi sở hữu của Frontend nên bao gồm:
  - UI components
  - page và flow behavior
  - client-side interaction state và polish
- Các agent chuyên trách nên có ranh giới ghi sửa rõ ràng theo file/path khi hợp lý.
- Các tác vụ cắt ngang nhiều lớp nên ở lại với điều phối viên chính, người sẽ giao các phần có phạm vi rõ cho specialist và sở hữu tích hợp cuối cùng.
- Handoff nên ngắn nhưng có cấu trúc:
  - đã làm gì
  - còn gì
  - assumptions
  - risks
- Mỗi tác vụ có ý nghĩa nên bắt đầu bằng bản tóm tắt nội bộ ngắn từ điều phối viên chính:
  - mục tiêu
  - người chịu trách nhiệm
  - ràng buộc
  - điều kiện hoàn thành
- Mỗi agent chuyên trách nên có checklist ngắn theo mảng của mình.
- Bộ nhớ nội bộ của team nên ghi lại có chọn lọc các bài học và quyết định có ý nghĩa theo dạng có cấu trúc.
- Một tác vụ của specialist chỉ được xem là "xong" khi specialist:
  - hoàn thành đúng phần phạm vi của mình
  - chạy checklist theo mảng
  - nói rõ phần nào còn chưa được kiểm chứng
- Tài liệu repo và checklist vẫn phải là bộ nhớ bền vững chuẩn.
- Bộ nhớ ngoài có thể tồn tại, nhưng chỉ là lớp truy hồi / hỗ trợ chứ không phải nguồn sự thật.
- Khi nhận định của specialist và điều phối viên chính xung đột, điều phối viên chính quyết định kết quả cuối cùng và nên ghi lại lý do.
- Bộ nhớ ngoài nên ưu tiên lưu:
  - quyết định
  - ràng buộc
  - lỗi lặp lại cần tránh
  - quy tắc đã được duyệt
- Bộ nhớ ngoài nên được truy vấn đúng lúc cần, không nạp mặc định mỗi lượt.
- Nếu external memory xung đột với repo docs hoặc checklists, repo-backed canonical notes phải thắng.
- Frontend không được tự ý đổi contract của backend. Nếu bị chặn, có thể đề xuất bản vá contract, mock payload, hoặc gói leo thang để backend/main review.
- Backend không được tự ý đổi câu chữ hiển thị cho người dùng. Có thể gợi ý wording an toàn, nhưng Product / UX phải sở hữu ngôn ngữ cuối cùng cho người dùng.
- Product / UX không được hợp nhất thay đổi UI hoặc copy khi thiếu technical sanity review, dù vẫn có thể có lối đi nhanh nhẹ cho thay đổi trình bày nhỏ.
- Phạm vi sở hữu của design system và UI consistency nên được chia sẻ giữa Frontend và Product / UX, trong đó Product / UX bảo vệ cảm giác sản phẩm còn Frontend bảo vệ tính nhất quán của triển khai.
- Backend nên sở hữu API, event-contract và tài liệu schema cắt ngang nhiều lớp.
- Mức sẵn sàng phát hành nên do điều phối viên chính sở hữu, với QA / Reviewer là cổng bắt buộc trước khi chốt cuối.
- Nhịp làm việc nội bộ nên hỗ trợ tiếp tục bằng ngôn ngữ tự nhiên: khi roadmap đã duyệt phạm vi, team có thể tự kéo bước triển khai hợp lệ tiếp theo mà không bắt owner phải đọc chi tiết cấp code.
- Với các quyết định triển khai nhỏ và vừa, điều phối viên chính nên dùng phán đoán tốt nhất và ghi lại giả định thay vì leo thang mọi điểm mơ hồ.
- Định hướng roadmap và phạm vi ở cấp phase vẫn phải do owner chặn duyệt, còn triển khai ở mức code trong phạm vi đã duyệt có thể tự chủ.
- Báo cáo không nên chờ theo nhịp hằng tuần.
- Nhịp báo cáo ưu tiên:
  - report sau mỗi meaningful completed chunk
  - tránh spam theo microtask quá nhỏ
-  - tránh bản tổng kết hằng tuần quá trễ
- Báo cáo nên chủ yếu được viết thành tệp trong repo, rồi gửi link bấm đọc trong chat.
- Độ dài báo cáo nên nằm trong mức founder-brief ngắn, không phải technical writeup dài.
- Khi cần xin duyệt roadmap hoặc phạm vi, nên đưa 2-3 phương án kèm khuyến nghị và đánh đổi.
- Khuôn dạng báo cáo nên mặc định rõ ràng kiểu founder-brief, nhưng linh hoạt theo loại việc thay vì cứng nhắc.
- Mẫu tệp báo cáo ưu tiên:
  - một tệp mới cho mỗi phần việc hoàn thành có ý nghĩa
  - mở đầu bằng mục tiêu của phần việc, rồi nêu phần đã hoàn thành
  - luôn có dòng ngắn "Bạn cần quyết định gì", kể cả khi câu trả lời là "không có gì lúc này"
- Nghiên cứu ngoài cho roadmap hoặc kiến trúc nên ưu tiên nguồn chính thức / nguồn gốc, nguồn thứ cấp chỉ để bổ sung góc nhìn.
- Với những quyết định có ý nghĩa, báo cáo nên phân biệt:
  - dữ kiện đã xác minh
  - suy luận
  - khuyến nghị / ý kiến
- Các agent nòng cốt nên có danh tính bền nhẹ thay vì hoàn toàn tạm thời.
- Mô hình bộ nhớ ưu tiên cho team nội bộ:
  - mỗi agent nòng cốt có bộ nhớ theo phạm vi riêng
  - một lớp bộ nhớ dùng chung nhỏ giữ các quyết định và quy tắc chung
- Cách thể hiện agent nên đủ dễ đọc với con người:
  - tên vai trò rõ ràng
  - cách làm việc ngắn gọn
  - chuyên môn và điều cấm rõ ràng
  - không cần màu mè nhân cách hóa quá mức
- Chính sách mở rộng cho team nội bộ nên chặt hơn với các agent code/build/release so với các agent research/review/support nhẹ hơn.
- Một agent mới nên được thêm khi một core agent bị quá tải hoặc liên tục bị buộc làm việc ngoài phạm vi của nó.
- Agent mới nên bắt đầu ở vai trò thử nghiệm trước khi vào core team.
- Team nên được hiện thực hóa trước tiên dưới dạng:
  - một bản đặc tả team có tài liệu
  - cộng với bộ tệp hồ sơ / kỹ năng có thể chạy ở mức tối thiểu
- Rollout ban đầu nên tập trung dùng team này để xây dựng chính Aio trước khi nghĩ tới triển khai rộng hơn.
- Thành công nên được đánh giá đồng thời ở:
  - giảm gánh điều phối cho owner
  - tăng tốc độ ship
  - cải thiện độ polish và chất lượng output
- Khi có đánh đổi, giảm gánh điều phối cho owner vẫn phải là phép thử đầu tiên của giá trị thực sự.
- Agent thử nghiệm đầu tiên sau core team nhiều khả năng nên là người rà soát UI sản phẩm.
- Tài liệu hồ sơ agent nên dễ đọc với con người nhưng vẫn chặt chẽ để vận hành:
  - vai trò
  - phạm vi sở hữu
  - điều cấm
  - đầu vào
  - đầu ra
