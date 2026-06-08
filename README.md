# 10S Studio - Trình Tạo Ảnh & Video AI (Gemini API Client)

Giao diện web khách (Client Dashboard) vô cùng đẹp mắt và mượt mà, sử dụng phong cách **Obsidian Dark & Glassmorphism** để gọi API tạo ảnh, video và chỉnh sửa video từ máy chủ Gemini API Server.

Dự án này được thiết kế tối giản, tải cực nhanh dưới dạng trang tĩnh (Static SPA) để có thể triển khai (Deploy) ngay lên **Vercel** hoặc bất kỳ dịch vụ hosting tĩnh nào khác mà hoàn toàn không tốn phí.

## ✨ Các tính năng nổi bật
* **Tạo Ảnh (Text-to-Image / Reference-to-Image):** Nhập prompt, đính kèm ảnh tham chiếu phong cách/sản phẩm.
* **Tạo Video (Text-to-Video):** Nhập prompt tạo video trực tiếp.
* **Chỉnh sửa & Tham chiếu:** Đính kèm 1 video và tối đa 3 ảnh tham chiếu để chỉnh sửa video gốc hoặc tạo chuyển động theo tham chiếu.
* **Hàng đợi tác vụ:** Theo dõi trạng thái của các tác vụ theo thời gian thực (Status polling) với thanh tiến trình và thông tin cập nhật chi tiết.
* **Lưu trữ lịch sử:** Lưu danh sách các tác vụ đã thực hiện trực tiếp vào `localStorage` của trình duyệt, không làm mất dữ liệu khi tải lại trang.
* **Cực kỳ trực quan:** Hiển thị trực tiếp hình ảnh hoặc trình phát video (kèm nút tải về tệp gốc) ngay khi tác vụ hoàn thành.

## 🛠️ Hướng dẫn Tích hợp & Kết nối
1. Khởi chạy máy chủ Gemini API Server ở máy tính local của bạn (bằng `run.bat`).
2. Mở cổng kết nối trực tuyến (Internet Tunnel) bằng tệp `online.bat`.
3. Sao chép địa chỉ URL công khai do Cloudflare Tunnel cấp (có dạng `https://xxxx.trycloudflare.com`).
4. Mở trang web **10S Studio** (local hoặc trên Vercel).
5. Điền **URL Máy chủ** vừa sao chép ở trên và **API Key** (được cấp từ trang quản trị `/cloudfire/admin`) vào khung kết nối ở Header và nhấn **Kết nối**.

## 🚀 Triển khai lên Vercel chỉ với 1-Click
1. Tạo một Repository mới trên GitHub của bạn.
2. Push mã nguồn này lên Repository đó.
3. Truy cập [Vercel](https://vercel.com) và đăng nhập bằng tài khoản GitHub.
4. Nhấn **Add New Project**, chọn Repository vừa tạo.
5. Nhấn **Deploy**. Vercel sẽ tự động cấu hình và cấp cho bạn một domain miễn phí dạng `.vercel.app` để truy cập trực tuyến từ bất kỳ thiết bị nào!

---
*Phát triển bởi 10S Studio Team. Tương thích hoàn toàn với bộ Cloudfire API.*
