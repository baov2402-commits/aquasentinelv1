# AquaSentinel – Hướng dẫn cài đặt và sử dụng

Hệ thống có 3 phần:

| Phần | Nằm ở | Làm gì |
| --- | --- | --- |
| Server | `server/server.js` | Nhận dữ liệu từ ESP32, chạy thuật toán phát hiện nguy hiểm, lưu tài khoản, thiết bị và nhật ký |
| Website | `server/public/` | Màn hình giám sát cho nhân viên cứu hộ, khu quản trị cho quản trị viên |
| Thiết bị | `esp32/AquaSentinel_ESP32/AquaSentinel_ESP32.ino` | Code nạp vào ESP32: đọc MPU6050, gửi dữ liệu, nút SOS, còi, rung |

```
ESP32 + MPU6050  --(WiFi, HTTP POST mỗi 0,5 giây)-->  Server Node.js  --(trực tiếp, 2 lần/giây)-->  Trình duyệt
```

---

## 1. Chạy server

**Cần:** Node.js phiên bản 18 trở lên (tải bản LTS ở nodejs.org). Không cần `npm install` vì server chỉ dùng thư viện có sẵn của Node.js.

```bash
cd server
node server.js
```

Màn hình sẽ hiện:

```
=== AquaSentinel server đang chạy ===
Trên máy này:      http://localhost:3000
Máy khác trong mạng: http://192.168.1.10:3000
Địa chỉ cho ESP32 (SERVER_URL): http://192.168.1.10:3000/api/data
```

- Mở `http://localhost:3000`. Lần đầu, trang web yêu cầu **tạo tài khoản quản trị đầu tiên**.
- Điện thoại hoặc máy khác **cùng WiFi** mở địa chỉ "Máy khác trong mạng".
- **Windows:** lần đầu chạy, Windows hỏi có cho Node.js truy cập mạng không. Chọn **Cho phép** (Private networks). Nếu bỏ qua bước này, ESP32 và điện thoại sẽ không vào được server.
- Đổi cổng: `PORT=8080 node server.js`. Trên Windows PowerShell: `$env:PORT=8080; node server.js`.

Dữ liệu (tài khoản, thiết bị, ngưỡng, nhật ký) lưu trong `server/data/db.json`. Muốn làm lại từ đầu thì tắt server, xóa file này rồi chạy lại.

## 2. Khu quản trị

Đăng nhập bằng tài khoản quản trị, bấm **Quản trị** trên thanh menu.

**Tài khoản:** thêm, sửa, đặt lại mật khẩu, xóa.
- *Quản trị viên*: toàn quyền.
- *Nhân viên cứu hộ*: chỉ xem màn hình giám sát, bấm "Đã tiếp nhận", bật hoặc tạm dừng giám sát từng người bơi.
- Hệ thống luôn giữ ít nhất 1 quản trị viên. Không thể tự xóa tài khoản đang đăng nhập.
- Đăng nhập sai 5 lần liên tiếp thì bị khóa 1 phút.

**Thiết bị:** thêm thiết bị gồm mã (ví dụ `AS-01`), tên người bơi và làn. Server tạo một **khóa thiết bị** riêng. Bấm **Code ESP32** để lấy 3 dòng cấu hình dán vào code ESP32.

**Ngưỡng cảnh báo:** sửa các ngưỡng của thuật toán. Thay đổi có hiệu lực ngay.

**Nhật ký:** mọi cảnh báo, ai tiếp nhận, ai thêm hoặc sửa gì. Lưu 1000 sự kiện gần nhất.

## 3. Nạp code cho ESP32

1. Cài **Arduino IDE**. Vào *Boards Manager*, cài **esp32 by Espressif Systems**.
2. Mở `esp32/AquaSentinel_ESP32/AquaSentinel_ESP32.ino`.
3. Sửa phần **CẤU HÌNH**: tên và mật khẩu WiFi, cùng 3 dòng `SERVER_URL`, `DEVICE_ID`, `DEVICE_KEY` lấy từ trang Quản trị.
4. Chọn board:
   - ESP32-C3 SuperMini: **ESP32C3 Dev Module**, *Tools > USB CDC On Boot: Enabled*
   - ESP32 DevKit: **ESP32 Dev Module**, nhớ đổi số chân như ghi chú trong code
5. Bấm Upload. Mở Serial Monitor (115200) để xem thông báo.
6. Khi bật nguồn, **để yên thiết bị khoảng 1 giây** để code hiệu chỉnh con quay.

Không cần cài thêm thư viện nào. Code đọc MPU6050 trực tiếp qua I2C.

### Sơ đồ nối dây (ESP32-C3 SuperMini)

| Linh kiện | Nối vào |
| --- | --- |
| MPU6050 VCC / GND | 3V3 / GND |
| MPU6050 SDA / SCL | GPIO6 / GPIO7 |
| Nút SOS | một chân vào GPIO3, chân kia vào GND (không cần điện trở) |
| Còi active | (+) vào GPIO4, (−) vào GND |
| LED | GPIO10 → điện trở 220Ω → chân dài LED, chân ngắn LED → GND |
| Động cơ rung | GPIO5 → điện trở 1kΩ → chân B của transistor S8050; chân E → GND; chân C → cực (−) động cơ; cực (+) động cơ → 3V3. Diode 1N4148 mắc ngược song song với động cơ (vạch của diode về phía 3V3) |
| Pin LiPo | vào B+ / B− của mạch sạc TP4056 |
| Nguồn | OUT+ của TP4056 → công tắc → chân 5V của SuperMini; OUT− → GND |
| Đo pin | OUT+ → 100kΩ → GPIO0 → 100kΩ → GND |

Trạng thái LED: nháy chậm là bình thường, nháy nhanh là mất kết nối server, sáng liên tục là đang báo động, chớp ngắn là lỗi cảm biến.

**Nút SOS:** giữ 1 giây. Thiết bị rung 1 lần khi nhận nút bấm, rung 3 lần khi server đã nhận được SOS.

## 4. Chạy thử khi chưa có phần cứng

**Cách 1, trên web:** trang Giám sát có khung **Mô phỏng khi trình diễn** (chỉ quản trị viên thấy). Tích "Mô phỏng" cho một thiết bị rồi chọn tình huống: Bất động, Vùng vẫy, Bấm nút SOS, Mất tín hiệu.

**Cách 2, giả lập một ESP32 thật** (gửi dữ liệu y như code ESP32):

```bash
cd server
node tools/fake-esp32.js --id AS-01 --key <khóa thiết bị> --url http://localhost:3000/api/data
```

Khi đang chạy, bấm phím: `n` bơi bình thường, `s` bất động, `v` vùng vẫy, `o` bấm SOS, `p` ngừng gửi (mất tín hiệu), `q` thoát.

## 5. Đưa lên server thật

### Khi đi thi (khuyên dùng)
Dùng laptop làm server. Bật điểm phát WiFi từ điện thoại hoặc laptop, cho ESP32, laptop và điện thoại cùng vào mạng đó. Không cần Internet: mất Internet thì chữ chỉ đổi sang font mặc định, mọi chức năng vẫn chạy. Kiểm tra lại địa chỉ IP mỗi lần đổi mạng, vì IP có thể khác.

### VPS Linux (Ubuntu)
```bash
# chép thư mục server lên VPS, ví dụ /opt/aquasentinel
sudo apt install -y nodejs        # cần bản >= 18; nếu bản cũ hơn, cài theo hướng dẫn trên nodejs.org
cd /opt/aquasentinel && node server.js
```

Để server tự chạy lại khi khởi động máy, tạo file `/etc/systemd/system/aquasentinel.service`:

```ini
[Unit]
Description=AquaSentinel
After=network.target

[Service]
WorkingDirectory=/opt/aquasentinel
ExecStart=/usr/bin/node server.js
Environment=PORT=3000
Restart=always

[Install]
WantedBy=multi-user.target
```

Sau đó chạy `sudo systemctl enable --now aquasentinel` và mở cổng 3000 trên tường lửa. ESP32 dùng `SERVER_URL = "http://<IP-VPS>:3000/api/data"`.

**Dùng tên miền và HTTPS:** đặt Nginx hoặc Caddy phía trước, chuyển tiếp về `localhost:3000`. Server đã hỗ trợ sẵn kết nối trực tiếp (cần tắt bộ đệm, header `X-Accel-Buffering` đã có). Code ESP32 tự dùng kết nối bảo mật khi `SERVER_URL` bắt đầu bằng `https://`.

### Render (render.com)

**Cần biết trước về gói miễn phí:**
- Server **tự ngủ sau 15 phút** không có ai truy cập. Lần truy cập kế tiếp phải chờ khoảng 1 phút để server thức dậy. Khi đang có ESP32 gửi dữ liệu, server không ngủ.
- Ổ đĩa là **ổ tạm**: mỗi lần server ngủ, khởi động lại hoặc deploy lại, file `data/db.json` bị xóa. Code đã xử lý việc này bằng biến `AQUA_CONFIG` (bước 6 bên dưới). Riêng **nhật ký vẫn bị mất**.
- Muốn dữ liệu và nhật ký không bao giờ mất: dùng gói trả phí, gắn **Persistent Disk** với mount path `/var/data`, rồi thêm biến môi trường `DATA_DIR=/var/data`.

**Các bước:**
1. Tạo repo trên GitHub, đẩy **cả thư mục `aquasentinel`** lên (gồm `render.yaml`, `server/`, `esp32/`). Có sẵn file `.gitignore` để không đẩy thư mục `data` lên.
2. Trên Render chọn **New → Blueprint**, rồi chọn repo đó. Render đọc `render.yaml` và tự điền mọi thứ: thư mục `server`, lệnh chạy `node server.js`, gói Free, vùng Singapore (gần Việt Nam nhất).
   - Hoặc làm tay: **New → Web Service**, chọn repo, *Root Directory* = `server`, *Build Command* = `npm install`, *Start Command* = `node server.js`, *Instance Type* = Free, *Region* = Singapore.
3. Lúc Render hỏi giá trị `AQUA_CONFIG`, **để trống** ở lần đầu.
4. Deploy xong, Render cho một địa chỉ dạng `https://aquasentinel-xxxx.onrender.com`. Mở địa chỉ đó và **tạo tài khoản quản trị ngay**, vì trước khi có tài khoản, ai vào trang cũng tạo được.
5. Thêm tài khoản và thiết bị như bình thường.
6. **Lưu cấu hình:** vào *Quản trị → Sao lưu*, bấm **Sao chép**. Trên Render mở dịch vụ → **Environment** → dán vào biến `AQUA_CONFIG` → **Save**. Từ đó, mỗi lần khởi động server tự nạp lại tài khoản và thiết bị. Khi cấu hình có thay đổi mà chưa lưu, trang Quản trị sẽ hiện thanh màu vàng nhắc.
7. Trong code ESP32, dùng địa chỉ **https**:
   ```cpp
   const char* SERVER_URL = "https://aquasentinel-xxxx.onrender.com/api/data";
   ```
   Code ESP32 tự nhận ra https và giữ kết nối mở giữa các lần gửi. ESP32 vẫn cần một WiFi có Internet.

**Chuyển dữ liệu từ máy tính lên Render:** trên máy tính vào *Quản trị → Sao lưu*, sao chép chuỗi. Dán chuỗi đó vào `AQUA_CONFIG` trên Render, hoặc vào ô *Khôi phục* trên trang Render. Khóa thiết bị giữ nguyên, nên không phải nạp lại code ESP32, chỉ cần đổi `SERVER_URL`.

**Giữ bí mật chuỗi cấu hình:** chuỗi này có khóa thiết bị và mật khẩu đã mã hóa. Không dán nó vào file trong repo GitHub.

## 6. Thuật toán (để trình bày)

Server xét **3 giây dữ liệu gần nhất**, 5 lần mỗi giây:
- **Dao động |a|**: độ lệch chuẩn của độ lớn gia tốc √(ax²+ay²+az²)
- **|ω| trung bình**: trung bình độ lớn vận tốc góc

| Tình huống | Điều kiện (mặc định) | Theo dõi | Nguy hiểm |
| --- | --- | --- | --- |
| Bất động | dao động \|a\| < 0,05 g và \|ω\| < 15 °/s | sau 5 giây | sau 10 giây |
| Vùng vẫy | dao động \|a\| > 0,6 g và \|ω\| > 200 °/s | sau 3 giây | sau 6 giây |
| SOS | người bơi giữ nút 1 giây | – | ngay lập tức |
| Mất tín hiệu | không nhận dữ liệu quá 5 giây | – | ngay lập tức |

Nếu dữ liệu ngừng đến khi đang báo nguy hiểm, hệ thống **giữ nguyên cảnh báo** rồi chuyển sang "Mất tín hiệu", không bao giờ tự báo "bình thường". Khi mất kết nối server, ESP32 tự phân tích bằng cùng ngưỡng và kêu còi tại chỗ.

**Lưu ý trung thực khi trình bày:** các ngưỡng mặc định là giá trị khởi đầu. Nhóm cần thu dữ liệu thật (bơi bình thường, nổi yên, giả lập vùng vẫy trong điều kiện an toàn) để chỉnh ngưỡng, và đo tỉ lệ báo đúng, báo nhầm. Sóng WiFi gần như không đi qua nước, nên thiết bị chỉ gửi được khi ở gần mặt nước. Vì vậy "Mất tín hiệu" được tính là một loại cảnh báo.

## 7. API (cho báo cáo kỹ thuật)

**ESP32 gửi dữ liệu:** `POST /api/data`, header `X-Device-Key: <khóa>`

```json
{ "id": "AS-01", "boot": 123456, "hz": 10, "sos": 0, "bat": 87, "rssi": -60,
  "samples": [[ax, ay, az, gx, gy, gz], ...] }
```

- `samples`: các mẫu theo thứ tự cũ đến mới. Gia tốc tính bằng g, vận tốc góc bằng °/s.
- `sos`: số lần đã bấm SOS kể từ lúc bật nguồn. Server báo SOS khi số này tăng.
- `boot`: số ngẫu nhiên tạo mỗi lần ESP32 khởi động, để server biết bộ đếm SOS đã quay về 0.

Server trả về: `{"ok":true,"status":"ok|watch|alarm|sos|offline|paused","ack":false,"sosId":0}`

Trình duyệt nhận dữ liệu trực tiếp qua `GET /api/stream` (Server-Sent Events). Các API quản trị nằm dưới `/api/users`, `/api/devices`, `/api/thresholds`, `/api/events`.

## 8. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Serial báo "Gửi lỗi: -1" | ESP32 không tới được server: kiểm tra IP trong `SERVER_URL`, ESP32 và server có cùng mạng không, tường lửa Windows đã cho phép Node.js chưa |
| Serial báo "Server từ chối" | Sai `DEVICE_ID` hoặc `DEVICE_KEY`. Lấy lại ở Quản trị > Thiết bị > Code ESP32 |
| "KHÔNG tìm thấy MPU6050" | Kiểm tra dây SDA/SCL có bị đảo, VCC, GND, mối hàn |
| Web báo "Bất động" khi thiết bị nằm trên bàn | Đúng thuật toán. Bấm "Tạm dừng" trên thẻ người bơi khi chưa đeo |
| Không có tiếng còi trên web | Trình duyệt chỉ cho phát âm thanh sau khi bấm vào trang ít nhất 1 lần |
| Bị đăng xuất sau khi khởi động lại server | Phiên đăng nhập lưu trong bộ nhớ, đăng nhập lại là được |
| Render: mở trang chờ rất lâu | Server miễn phí đang ngủ, chờ khoảng 1 phút rồi tải lại trang |
| Render: mất hết tài khoản, phải tạo lại từ đầu | Chưa lưu `AQUA_CONFIG` (xem phần Render, bước 6) |
