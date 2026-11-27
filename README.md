# AquaSentinel — Giám sát An toàn Hồ bơi

Hệ thống giám sát an toàn hồ bơi thông minh theo thời gian thực với mô phỏng cảm biến ESP32 + MPU6050, cảnh báo vùng vẫy / bất động / SOS, đăng nhập điều hành viên và sẵn sàng triển khai trên **GitHub + Vercel**.

## Tính năng chính
- **Đăng nhập & Quản lý tài khoản**: Đăng nhập / Đăng ký tài khoản Cứu hộ viên hoặc Quản lý hồ bơi, hỗ trợ vào nhanh chế độ Demo.
- **Bảng xem hồ bơi trực quan**: Hiệu ứng mặt nước gợn sáng (caustics), lưới kích thước 1m, chọn chế độ bơi tự do hoặc bơi theo làn, click trực tiếp vào người bơi để kiểm tra thông số.
- **Giám sát cảm biến ESP32 + MPU6050**: Kết nối WebSocket (`ws://`) hoặc HTTP Polling từ ESP32 thật, hoặc chạy mô phỏng các tình huống An toàn, Vùng vẫy, Bất động, Nút SOS kèm âm thanh cảnh báo.
- **Đồ thị & Tư thế thời gian thực**: Biểu đồ gia tốc `|a|` kèm ngưỡng cảnh báo `2.2g` và mô hình góc nghiêng cơ thể trực quan.

## Hướng dẫn đưa lên GitHub & Deploy lên Vercel

### 1. Đẩy mã nguồn lên GitHub
```bash
git init
git add .
git commit -m "Initial commit: AquaSentinel Pool Monitor"
git branch -M main
git remote add origin https://github.com/<ten-cua-ban>/aquasentinel.git
git push -u origin main
```

### 2. Deploy lên Vercel
1. Truy cập [vercel.com/new](https://vercel.com/new) và đăng nhập bằng tài khoản **GitHub**.
2. Chọn repository `aquasentinel` vừa tạo và nhấn **Import**.
3. Vercel sẽ tự động nhận diện cấu hình từ `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Nhấn **Deploy** và chờ khoảng 30 giây để nhận đường dẫn trang web hoạt động trực tiếp.
