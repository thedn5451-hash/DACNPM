# Thiết kế giao diện và chức năng Frontend

Tài liệu này cập nhật theo phần “Thiết kế giao diện và mô tả chức năng Frontend” trong [TÀI LIỆU PHÂN TÍCH](../TÀI%20LI%E1%BB%86U%20PH%C3%82N%20T%C3%8DCH.docx), các Use Case UC01–UC02 và đặc tả giỏ hàng/đặt hàng COD.

## 1. Định hướng giao diện

- Dùng nền sáng, màu cam san hô làm điểm nhấn; giữ header, footer, kiểu chữ và trạng thái nút nhất quán.
- Ưu tiên tìm kiếm, danh sách sản phẩm, bộ lọc có nhãn và chip bộ lọc có thể xóa.
- Có trạng thái đang tải, lỗi, rỗng và thử lại; lỗi API không được thay bằng dữ liệu mẫu hoặc thông báo thành công giả.
- Bố cục desktop/tablet/mobile responsive; bộ lọc chuyển thành drawer trên màn hình nhỏ, không yêu cầu cuộn ngang.
- Giá, ảnh, thuộc tính, biến thể, đánh giá và tồn kho chỉ hiển thị khi máy chủ cung cấp.

## 2. Màn hình khách hàng

### Trang chủ

Giới thiệu LaptopStore, tìm kiếm, liên kết danh sách laptop và các danh mục nhận từ dữ liệu hệ thống. Không hiển thị số liệu đánh giá, chương trình giảm giá, điều kiện giao hàng/bảo hành hoặc thông tin liên hệ chưa được cung cấp.

### Danh sách và tìm kiếm

Trang `/laptops` và `/search?q=...` hiển thị breadcrumb, từ khóa hiện tại, bộ lọc, sắp xếp, số lượng kết quả, thẻ sản phẩm và nút tải thêm nếu API có phân trang. Bộ lọc và lựa chọn sắp xếp chỉ được dựng từ `filter_fields`, `facets` và `sort_options` do API trả về. Hỗ trợ xóa từng chip hoặc toàn bộ điều kiện. Khi không có kết quả, hướng dẫn sửa từ khóa/bộ lọc; khi API lỗi, hiển thị lỗi và nút thử lại, không giữ kết quả cũ như dữ liệu mới.

### Thẻ và chi tiết laptop

Thẻ sản phẩm chỉ hiển thị dữ liệu được trả về. Giá gốc chỉ hiện khi backend trả về giá hợp lệ lớn hơn giá bán; không tự tính khuyến mãi. Tình trạng hết hàng hoặc chưa có dữ liệu tồn kho được nêu rõ và không cho thao tác mua. Ảnh lỗi dùng ảnh thay thế. Trang chi tiết tải theo mã sản phẩm, hỗ trợ ảnh thu nhỏ và biến thể nếu có trong dữ liệu; giá và tồn kho thay đổi theo biến thể được chọn.

### Giỏ hàng, đặt hàng và đơn hàng

Giỏ khách chưa đăng nhập lưu `guest_cart` dưới dạng mã sản phẩm/số lượng; trước khi cập nhật, gửi giỏ tới `POST /api/cart/preview` để máy chủ kiểm tra giá và tồn kho. Giỏ đã đăng nhập dùng các API giỏ hàng; khi đăng nhập, gửi giỏ khách tới `POST /api/cart/merge` và chỉ xóa giỏ tạm khi gộp thành công.

Đặt hàng yêu cầu đăng nhập, nhập họ tên, số điện thoại, địa chỉ và ghi chú tùy chọn; phương thức thanh toán hiện là COD. Client kiểm tra định dạng số điện thoại để hỗ trợ nhập liệu, còn giá/tồn kho và kết quả đặt hàng do backend quyết định. Lịch sử và chi tiết đơn tải từ các API đơn hàng của tài khoản hiện tại.

### Tài khoản

Đăng ký, đăng nhập JWT, hồ sơ, cập nhật hồ sơ, đổi mật khẩu và đăng xuất gọi API tài khoản Django hiện có. Token được lưu trong `sessionStorage` trong phiên tab. Hồ sơ và lịch sử đơn chỉ hiển thị sau khi backend xác thực.

## 3. Tích hợp dữ liệu

### Cấu hình API sản phẩm

Trước `product-service.js`, có thể cấu hình các biến:

- `window.LAPTOPIA_API_BASE`: URL gốc API; mặc định `http://127.0.0.1:8000`.
- `window.LAPTOPIA_PRODUCTS_ENDPOINT`: endpoint danh sách/chi tiết sản phẩm; mặc định `${API_BASE}/api/products/`.
- `window.LAPTOPIA_PRODUCT_DETAIL_ENDPOINT`: mẫu endpoint chi tiết, dùng `{id}` làm chỗ đặt mã sản phẩm.

API danh sách cần trả mảng hoặc `results`/`products`/`items`; có thể trả thêm `count`, `next`/`has_more`, `facets`, `filter_fields` và `sort_options`. Bộ lọc chỉ gửi khi API đã thông báo trường tương ứng hỗ trợ. API sản phẩm chưa có trong backend hiện tại, vì vậy trang hiển thị trạng thái lỗi có thể thử lại thay vì dựng dữ liệu mẫu. Cần thống nhất schema sản phẩm và cấu hình CORS với backend khi API sẵn sàng.

### Các endpoint tích hợp

**Tài khoản Django hiện có**

- `POST /api/accounts/register/`
- `POST /api/accounts/token/`
- `GET/PATCH /api/accounts/profile/`
- `POST /api/accounts/change-password/`
- `POST /api/accounts/logout/`

**Endpoint giỏ hàng/đơn hàng theo đặc tả trong tài liệu phân tích**

- `POST /api/cart/preview`, `GET /api/cart`
- `POST /api/cart/merge`, `POST /api/cart/items`
- `PUT/DELETE /api/cart/items/:productId`
- `DELETE /api/cart`
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`

Các endpoint giỏ hàng và đơn hàng cũng chưa được khai báo trong backend Django hiện có. Frontend báo lỗi máy chủ nếu các dịch vụ này chưa được triển khai; không giả lập thành công. PayOS, mã giảm giá, đánh giá sản phẩm và giao diện nghiệp vụ nhân viên nằm ngoài phạm vi tích hợp hiện tại.

## 4. Thành phần mã nguồn

- `index.html`: khung trang khách hàng, trạng thái danh mục/danh sách và hộp thoại tài khoản, giỏ hàng, đặt hàng, đơn hàng.
- `config.js`: URL gốc API mặc định; chỉnh file này để trỏ tới backend đang chạy.
- `styles.css`: hệ thống kiểu dáng và breakpoint responsive.
- `product-service.js`: tập trung gọi API danh sách/chi tiết, chuẩn hóa dữ liệu sản phẩm và lỗi API.
- `core.js`: trạng thái dùng chung, tiện ích giao diện và API client cho tài khoản/giỏ hàng/đơn hàng.
- `router.js`: điều hướng SPA và đồng bộ URL.
- `catalog-controller.js`: tải/render danh sách, bộ lọc, chi tiết sản phẩm.
- `cart-controller.js`: giỏ khách/đăng nhập, tính trước giỏ hàng và thao tác số lượng.
- `account-controller.js`: đăng nhập, đăng ký, hồ sơ và đăng xuất.
- `order-controller.js`: checkout COD và lịch sử/chi tiết đơn hàng.
- `app.js`: lớp khởi tạo ứng dụng và gắn các sự kiện giao diện.

Các controller được tổ chức theo lớp kế thừa từ `LaptopStore.Core`; script được nạp theo thứ tự trong `index.html` để tương thích khi mở trực tiếp bằng `file://`.

Mở [index.html](./index.html) để xem giao diện. Khi chạy với backend khác origin, cần cấu hình CORS và đặt API base/endpoint đúng với dịch vụ triển khai.
