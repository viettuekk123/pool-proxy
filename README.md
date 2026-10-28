# PTK Proxy Tools

Trung tâm điều khiển router AI chạy local trên Windows. Bản 1.0 dùng engine đầy đủ được fork từ mã nguồn MIT, bổ sung thiết lập tập trung và tách provider theo ứng dụng. Tên sản phẩm là **PTK Proxy Tools**; thông tin nguồn và giấy phép nằm trong `UPSTREAM.json`, `THIRD_PARTY_NOTICES.json` và `engine/LICENSE`.

## Mở hằng ngày

1. Mở `start.cmd` trong thư mục dự án, giữ cửa sổ đó chạy.
2. Vào **http://127.0.0.1:21000/dashboard/local-setup**.
3. Mật khẩu local ban đầu: `123456`. Đổi trong Settings khi bắt đầu dùng.
4. API: **http://127.0.0.1:21000/v1**. Health: `/api/health`.

Chỉ cần chạy lại PTK sau khi tắt máy/đóng server. Key, tài khoản, alias, combo và lựa chọn MITM được lưu trên đĩa. Không cần tạo lại mỗi lần mở app. Đóng riêng Antigravity rồi mở lại không xóa cấu hình PTK; Antigravity vẫn quản lý phiên Google login của chính app.

Khi cần MITM Antigravity, chạy `start.cmd` bằng **Run as administrator**, rồi Start MITM và bật DNS Antigravity trong dashboard. Router HTTP thông thường không cần Administrator. PTK không tự chiếm port 443 hoặc tự tắt router đang dùng.

## Thiết lập lần đầu

Trong **Thiết lập local**:

1. Bấm **Tạo / đồng bộ 3 profile app**. Thao tác này tạo key riêng, alias và chọn key MITM, không sửa cấu hình ứng dụng hay hosts.
2. Vào **Providers** để đăng nhập tài khoản Codex/Antigravity hoặc thêm API key/custom endpoint.
3. Có thể **Xem nguồn → Nhập tài khoản đã chọn** từ database router cũ. PTK đọc nguồn, sao lưu data PTK rồi sao chép các credential cần thiết. Tài khoản nhập được để **TẮT**; Quota Tracker không hỏi quota hay refresh token khi tài khoản đang tắt. Dừng router cũ trước khi bật tài khoản này trong PTK để tránh xung đột refresh token. Không chép key app cũ, cooldown, proxy hay log chat.
4. Cấu hình app bằng key tương ứng ở **Endpoint & Key**.

| Profile | Quyền mặc định | Mục đích |
| --- | --- | --- |
| PTK · Codex | `cx/*` | Chỉ model của provider Codex |
| PTK · Antigravity | `ag/*` | MITM Antigravity dùng provider Antigravity |
| PTK · Cursor AG | `ag/*` | Cursor gọi model của provider Antigravity |

Scope theo provider tự nhận model mới. Ví dụ thêm `ag/gemini-...` không cần cấp lại từng model cho key `ag/*`. Quyền kiểm tra sau khi resolve alias nên alias không vượt được giới hạn provider. Combo vẫn phải cấp quyền bằng tên combo; khi cho phép một combo, toàn bộ thành viên combo đó có thể được gọi qua combo. Không cấp combo trộn provider cho key muốn tách riêng.

Bấm đồng bộ lại sẽ đưa ba profile về quyền mặc định và bật lại chúng. Các key mới hiển thị ngay khi tạo; sau đó có thể xem/copy trong Endpoint & Key. Có thể pause, xóa hoặc chỉnh quyền của từng key tại đó.

## Những tính năng đã có

| Trang | Chức năng |
| --- | --- |
| Thiết lập local | Profile app, import, port/DNS, hướng dẫn và chẩn đoán |
| Providers | OAuth nhiều tài khoản, API key, ưu tiên/round-robin, custom OpenAI/Anthropic-compatible endpoint |
| Endpoint & Key | Endpoint local, key riêng, bật/tắt/xóa key, giới hạn model/combo/provider |
| Combo & Vision Adapter | Chuỗi fallback, chiến lược theo combo, adapter vision/PDF/audio/video |
| Usage | Request, token, chi phí ước tính, thống kê theo model/provider/account/key; lưu SQLite |
| Quota Tracker | Quota do provider hỗ trợ, reset và trạng thái tài khoản |
| Token Saver | Prompt saver, custom system prompt, adapter nén; công cụ ngoài cần cài khi chọn dùng |
| CLI Tools | Đọc/áp dụng cấu hình các client được hỗ trợ, có cấu hình thủ công |
| MITM | CA local, chuyển hướng hosts theo công cụ, ánh xạ model, ghi nhớ key khi restart |
| Proxy Pools | HTTP/SOCKS/outbound pool cho kết nối ra provider |

Quota chính thức phụ thuộc từng provider. Usage local và chi phí theo bảng giá không thay thế số liệu billing của nhà cung cấp. Các tùy chọn nén prompt có thể thay đổi nội dung gửi tới model; bật khi phù hợp.

## Kết nối từng app

### Codex

Vào **CLI Tools → Codex**. Chọn endpoint PTK, key **PTK · Codex**, model `cx/<model-id>` và Apply. Cấu hình sinh ra dùng `model_provider = "ptk"`, `wire_api = "responses"` và Authorization header. PTK sao lưu `config.toml.ptk-backup-<timestamp>` trước khi áp dụng/reset; không sửa `auth.json` đăng nhập.

File chính: `%USERPROFILE%\.codex\config.toml`. Project tin cậy có thể có `.codex/config.toml` ghi đè cấu hình user; chat cũ cũng có metadata provider riêng. Dùng chat mới để kiểm tra sau khi chuyển. Reset chỉ gỡ section provider PTK, giữ các section provider khác; khôi phục file backup nếu muốn quay lại toàn bộ cấu hình trước đó.

Tài liệu cấu hình: https://developers.openai.com/codex/config-advanced

### Antigravity desktop

1. Antigravity vẫn cần Google login. Provider Antigravity trong PTK cần có tài khoản hoạt động.
2. Dừng MITM cũ đang giữ port 443 bằng công cụ đã mở nó. Không chạy hai MITM trên cùng port.
3. Mở PTK bằng Administrator, vào **MITM**. Chọn **PTK · Antigravity**, router base `http://127.0.0.1:21000` (không thêm `/v1`).
4. Start MITM, kiểm tra Cert/Trusted/Server. Bật DNS cho **Antigravity**.
5. Mở lại Antigravity, gửi một câu ngắn; xem Usage để xác nhận provider/account thực tế.

PTK lưu key MITM theo ID, không lấy key đầu danh sách sau restart. Chỉ gỡ các dòng hosts có marker `# PTK-Proxy-Tools`; quy tắc của router khác phải được tắt bằng router đó. Dùng Stop MITM/Disable DNS để về kết nối trực tiếp. CA của PTK tách riêng với tên **PTK Proxy Tools MITM Root CA**.

**DNS:** `google-doh` đã được chọn theo sự cho phép của người dùng. Nó resolve upstream qua `https://dns.google/resolve`, có timeout và cache; tên miền upstream được gửi tới Google DNS. Đây là DNS cho proxy nối tới máy chủ thật, không phải đổi DNS của toàn Windows. Có thể chọn lại DNS hệ thống trong Thiết lập local rồi restart PTK.

App vẫn có thể yêu cầu đăng nhập lại vì phiên Google hoặc hành vi riêng của app; proxy không thay thế bước đăng nhập. Chưa kiểm chứng tài khoản thật hoặc toàn bộ chức năng desktop qua PTK trong lần build này.

### Cursor

Trong AI/Models settings, nhập key **PTK · Cursor AG**, override OpenAI base URL `http://127.0.0.1:21000/v1`, thêm model chính xác `ag/<model-id>`. Khả năng dùng custom endpoint/BYOK phụ thuộc phiên bản, tính năng và gói Cursor; bật key không tự mở quyền model trả phí của Cursor. Khi Cursor đòi endpoint công khai, bản PTK local không cung cấp tunnel. Không bật DNS MITM Cursor: adapter Cursor của engine nguồn hiện chưa hoàn chỉnh.

### Nối router khác

Providers → custom OpenAI-compatible hoặc Anthropic-compatible. Đặt prefix riêng, base URL của router đích, thêm key của router đó và chọn giao thức chat/Responses đúng. Client gọi model `prefix/model-id`; PTK sẽ gửi ID model phía router đích. Có thể thêm nhiều connection làm key pool, hoặc combo dùng nhiều prefix để fallback. Không trỏ upstream về chính PTK hay tạo vòng PTK → router → PTK.

Proxy Pools là proxy mạng đầu ra (HTTP/SOCKS), khác với custom AI endpoint. Model fallback/key rotation phụ thuộc lỗi upstream và chiến lược engine; không đảm bảo request lỗi chưa bị tính phí.

## Cấu hình và dữ liệu tập trung

- `ptk.config.json`: port, `dataDir`, `mitmDns`. Port và DNS có thể sửa ngay trên trang Thiết lập local. Cần restart PTK để áp dụng. Thay `dataDir` không tự di chuyển dữ liệu.
- `data/engine/db/data.sqlite`: tài khoản, key, cấu hình, alias, combo và usage.
- `data/engine/backups/`: snapshot trước tạo profile/import. Có thể chứa credential.
- `data/engine/mitm/`: CA, alias cache và trạng thái MITM.
- `data/engine/auth/`: secret cho phiên dashboard/CLI; không chia sẻ.

Thay key/model/combo qua dashboard có hiệu lực ngay. Không chỉnh SQLite lúc server đang chạy. Để backup, dừng PTK rồi sao chép cả `data/engine` và `ptk.config.json`; khi restore giữ nguyên vị trí hoặc sửa `dataDir`.

**Credential và backup lưu trên đĩa local, không được mã hóa toàn bộ.** Không commit/share thư mục data. Launcher bind `127.0.0.1`, có kiểm tra Host/Origin; giữ đăng nhập dashboard và yêu cầu API key. Analytics mặc định đã được gỡ. Nút tunnel, deploy cloud relay và updater package nguồn bị tắt trong bản local; kết nối tới provider/OAuth/DNS đã chọn vẫn cần mạng.

## Cài/build lại

Máy cần Node.js **22.13+** (khuyên dùng 24) và npm. Nếu PATH còn Node 20, launcher sẽ tìm runtime Node mới có sẵn trong cache Codex; cũng có thể đặt `PTK_NODE` tới đường dẫn node.exe.

Các client OAuth Google không nằm trong Git vì GitHub Push Protection xem chúng là secret. Khi cần dùng OAuth trên máy clone mới, tạo `engine/.env.local` rồi thêm bốn biến được liệt kê cuối `engine/.env.example`: `PTK_ANTIGRAVITY_OAUTH_*`/`PTK_GOOGLE_OAUTH_*` bằng giá trị từ thiết lập local của bạn. File này đã được Git bỏ qua.

```powershell
cd D:\dvt-tools\tools-nha-lam\pool-proxy
npm run setup
npm run build
npm start
```

Hoặc mở `setup.cmd`, sau đó `start.cmd`. `setup` dùng lockfile và `--ignore-scripts --legacy-peer-deps`. Build local chạy với toàn bộ `engine/node_modules`; không phải gói standalone để chỉ copy `.next` sang máy khác.

CLI:

```powershell
npm run cli -- health
npm run cli -- config
npm run cli -- profiles
npm run cli -- doctor
npm run cli -- bootstrap
```

`bootstrap` tương đương đồng bộ ba profile, có thể in key vừa tạo vào terminal. Giữ output riêng. CLI quản trị xác thực bằng secret của data PTK trên máy, không in token phiên đăng nhập.

## Chẩn đoán nhanh

| Hiện tượng | Kiểm tra |
| --- | --- |
| PTK không mở | Cửa sổ start.cmd; port trong ptk.config.json; launcher không tự giết process đang giữ port |
| 401 Invalid API key | Copy đúng key PTK đang bật; bỏ placeholder; kiểm tra endpoint đang trỏ PTK |
| 403 model not allowed | Đúng profile/provider; `cx/*` hoặc `ag/*`; alias và combo; key cũ của router khác không dùng chung |
| 429/quota | Tài khoản/provider thực tế, Quota Tracker và Usage; scope không tăng quota |
| Antigravity mất mạng | Domain bị chuyển về 127.0.0.1 nhưng MITM443 chưa chạy; bật lại MITM hoặc Disable DNS đúng router |
| DNS UDP timeout | Chọn Google DNS qua HTTPS cho MITM, restart PTK |
| Đổi model vẫn vào provider cũ | Cấu hình app/project/chat đang ghi đè; kiểm tra request trong Usage |
| Thiếu công cụ nén | Tắt adapter ngoài hoặc cài đúng dependency theo Token Saver |

## Kiểm thử

```powershell
npm run check
npm test
npm run test:engine
```

`test:engine` là suite chọn lọc cho phân quyền key, Antigravity/MITM, combo và usage; không phải toàn bộ suite nguồn. Runtime smoke dùng `npm run smoke:start` ở terminal riêng rồi `npm run test:smoke`; fixture chỉ nghe 21009 với data/home/AppData riêng và upstream giả. Không chạy smoke vào server có tài khoản thật. Kết quả tại `data/verification/smoke.json`.

Kiểm thử fixture chứng minh đường HTTP, chuyển đổi, phân quyền và lưu dữ liệu. Việc đăng nhập OAuth, quota thật, Cursor BYOK và HTTPS trong Antigravity app cần kiểm chứng riêng với app/tài khoản thật sau khi chọn chuyển sang PTK.

`start:gateway`, `src/server.js`, `public/` và `config.example.json` là gateway thử nghiệm tối giản cũ dành cho phát triển; `npm start` sử dụng engine đầy đủ và `ptk.config.json`.
