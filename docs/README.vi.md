# PTK Proxy Tools — hướng dẫn sử dụng

Tài liệu này hướng dẫn cài và vận hành PTK Proxy Tools trên Windows. PTK chạy local, cung cấp API tương thích OpenAI/Responses tại `127.0.0.1` và có thể chuyển tiếp tới nhiều provider. Tài khoản, API key, combo, usage, chứng chỉ MITM và cấu hình được lưu trên máy.

Tài liệu dành cho bản source PTK 1.0. Model mẫu minh họa cách đặt tên; quyền truy cập và danh sách model thực tế phụ thuộc tài khoản/provider đang kết nối. [README dự án](../README.md) chứa phần mở nhanh.

### Mục lục

- [1. Yêu cầu](#requirements)
- [2. Cài lần đầu](#install)
- [3. Chạy và dùng hằng ngày](#run)
- [4. Profile và quyền model](#profiles)
- [5. Provider, OAuth và nhập tài khoản cũ](#providers)
- [6. Codex](#codex)
- [7. Cursor](#cursor)
- [8. Antigravity desktop](#antigravity)
- [9. Nối router, proxy và combo](#routing)
- [10. Cấu hình, sao lưu và reset](#configuration)
- [11. CLI quản trị](#cli)
- [12. Xử lý lỗi](#troubleshooting)
- [13. Kiểm thử phát triển](#testing)
- [14. Hoàn tác và gỡ cài đặt](#uninstall)
- [15. Gọi API từ PowerShell](#api)
- [16. Cập nhật mã nguồn](#updates)
- [17. Giới hạn và mức kiểm chứng](#limits)

<a id="requirements"></a>

## 1. Yêu cầu

- Windows 10 hoặc Windows 11.
- Node.js 22.13 trở lên, khuyên dùng Node.js 24.
- npm đi kèm Node.js.
- Kết nối mạng khi cài dependency và khi gọi provider.
- Quyền Administrator chỉ cần cho MITM/DNS Antigravity; router HTTP local không cần.

Kiểm tra trong PowerShell:

```powershell
node --version
npm --version
```

Nếu `node` hiện bản thấp hơn 22.13, cài Node mới rồi mở lại PowerShell. Launcher cũng tìm runtime Node mới trong cache Codex; có thể chỉ rõ đường dẫn bằng biến `PTK_NODE`.

<a id="install"></a>

## 2. Cài lần đầu

Nếu chưa có mã nguồn, cài Git rồi clone vào thư mục bạn chọn:

```powershell
git clone https://github.com/viettuekk123/pool-proxy.git
cd pool-proxy
```

Cũng có thể tải ZIP từ GitHub rồi giải nén. Các lệnh tiếp theo phải chạy trong thư mục chứa `package.json`, `start.cmd` và `ptk.config.json`; không chạy từ bên trong `engine`.

Mở PowerShell tại thư mục dự án:

```powershell
cd D:\dvt-tools\tools-nha-lam\pool-proxy
npm run setup
npm run build
```

`setup` cài dependency của engine bằng lockfile và bỏ qua lifecycle script. `build` tạo bản production trong `engine/.next`. Hai lệnh cần chạy lại khi clone máy mới hoặc sau khi xóa `engine/node_modules`.

Có thể mở `setup.cmd`; file này chạy setup rồi build. Nếu lệnh dừng giữa chừng, đọc cửa sổ PowerShell để biết package hoặc phiên bản Node nào lỗi, sửa xong chạy lại lệnh tương ứng.

<a id="run"></a>

## 3. Chạy và đăng nhập dashboard

Chạy:

```powershell
npm start
```

Hoặc mở `start.cmd`. Giữ cửa sổ server mở trong lúc dùng PTK.

Mở các địa chỉ sau:

| Địa chỉ | Mục đích |
| --- | --- |
| `http://127.0.0.1:21000/dashboard/local-setup` | Thiết lập local, profile và chẩn đoán |
| `http://127.0.0.1:21000/dashboard/providers` | OAuth, API key và provider |
| `http://127.0.0.1:21000/dashboard/endpoint` | Key, endpoint và quyền model |
| `http://127.0.0.1:21000/dashboard/mitm` | CA, MITM và DNS cho app |
| `http://127.0.0.1:21000/dashboard/usage` | Request, token và chi phí ước tính |
| `http://127.0.0.1:21000/dashboard/quota` | Quota do provider hỗ trợ |
| `http://127.0.0.1:21000/api/health` | Kiểm tra server |

Mật khẩu local mặc định là `123456`. Đổi ngay trong Settings. Dashboard và API chỉ bind vào loopback; không mở port này ra Internet.

Nếu đổi port trong `ptk.config.json`, mở lại PTK sau khi lưu. `start.cmd` không tự dừng process đang giữ port; dừng process cũ hoặc chọn port khác.

### Mỗi ngày cần làm gì?

| Tình huống | Thao tác |
| --- | --- |
| Dùng Codex/Cursor qua API | Mở `start.cmd`, chờ server sẵn sàng rồi mở app |
| Dùng Antigravity qua MITM | Mở PTK bằng Administrator; kiểm tra MITM đang chạy, CA trusted và DNS Antigravity đã bật |
| Chỉ đóng rồi mở lại app | Giữ PTK chạy; key/profile không cần tạo lại; app có thể vẫn yêu cầu login riêng |
| Vừa khởi động lại Windows | Mở PTK lại và kiểm tra MITM nếu cần; không giả định server tự chạy |
| Dừng proxy Antigravity | Disable DNS, Stop MITM, rồi `Ctrl+C` trong cửa sổ PTK |

Không cần chạy `setup` hoặc `build` mỗi lần mở. Đăng nhập dashboard khác đăng nhập Google trong Antigravity và khác OAuth provider trong PTK.

<a id="profiles"></a>

## 4. Tạo ba profile app

Trong **Thiết lập local**, bấm **Tạo / đồng bộ 3 profile app**. PTK tạo hoặc cập nhật:

| Profile | Scope mặc định | Dùng cho |
| --- | --- | --- |
| `PTK · Codex` | `cx/*` | Codex gọi provider Codex |
| `PTK · Antigravity` | `ag/*` | MITM Antigravity |
| `PTK · Cursor AG` | `ag/*` | Cursor gọi model Antigravity qua OpenAI-compatible API |

Copy key ở phần **Kết quả thao tác** khi vừa tạo hoặc tại **Endpoint & Key**. API trạng thái Thiết lập local chỉ trả bốn ký tự cuối; không dùng chuỗi rút gọn đó làm key.

Scope kiểm tra sau khi resolve alias. Key `cx/*` không gọi được `ag/*`, và ngược lại. Khi thêm model mới cùng provider, scope dạng `ag/*` hoặc `cx/*` tự nhận model đó.

### Chỉnh quyền và quản lý key

1. Trong Thiết lập local, sửa ô **Allowed models / provider scopes** của profile.
2. Nhập danh sách cách nhau bằng dấu phẩy, ví dụ `ag/*, ag-backup` nếu đã tạo combo `ag-backup` chỉ chứa model Antigravity.
3. Bấm **Lưu quyền**. Key giữ nguyên, quyền thay đổi có hiệu lực với request tiếp theo.
4. Muốn tạm ngừng hoặc xóa key, dùng **Endpoint & Key** rồi cập nhật app nếu tạo key thay thế.

Bấm **Tạo / đồng bộ 3 profile app** lần nữa sẽ bật lại ba key và đưa quyền về mặc định, đồng thời đồng bộ alias/key MITM. Các chỉnh sửa quyền riêng trước đó có thể bị thay thế. Đồng bộ không tự cấu hình app, bật hosts hay đăng nhập provider.

### Ba loại thông tin dễ nhầm

| Thông tin | Nơi sử dụng |
| --- | --- |
| Key PTK | App gửi tới `127.0.0.1:21000/v1`; quyết định quyền model local |
| Tài khoản OAuth/API key upstream | Providers dùng để gọi Codex, Antigravity hoặc router đích |
| OAuth client ID/secret Google | Biến local phục vụ đăng nhập/refresh Google; không dán vào ô API key của app |

<a id="providers"></a>

## 5. Đăng nhập provider

Vào **Providers** rồi chọn provider cần dùng.

- **Codex/Antigravity:** dùng luồng OAuth trong dashboard và hoàn tất trình duyệt.
- **Gemini CLI:** dùng luồng OAuth Google nếu được hỗ trợ; provider **Gemini** thông thường nhận API key trong bản này.
- **API provider:** dán API key vào form của provider, chọn base URL nếu là endpoint tương thích.
- **Custom OpenAI-compatible:** đặt prefix riêng, base URL có thể kết thúc bằng `/v1`, giao thức Chat Completions hoặc Responses đúng với router đích.
- **Custom Anthropic-compatible:** chọn giao thức Messages và kiểm tra header/đường dẫn theo router đích.

Đừng nhập token vào Git, issue, ảnh chụp màn hình hoặc file `README`. Credential được lưu trong `data/engine`; thư mục này đã bị Git ignore.

### OAuth Google trên máy clone mới

GitHub Push Protection xem OAuth client của Google là secret, vì vậy source không chứa giá trị thật. Tạo file local:

```powershell
notepad engine\.env.local
```

Nếu Notepad hỏi tạo file, chọn tạo mới. Chỉ thêm các biến cần dùng từ cuối `engine/.env.example`; không sao chép nguyên file ví dụ upstream vì có port, đường dẫn Linux và placeholder dành cho cách chạy khác. Nếu file đã tồn tại, giữ những thiết lập đang dùng.

Điền bốn biến sau bằng giá trị từ thiết lập local của bạn:

```dotenv
PTK_ANTIGRAVITY_OAUTH_CLIENT_ID=
PTK_ANTIGRAVITY_OAUTH_CLIENT_SECRET=
PTK_GOOGLE_OAUTH_CLIENT_ID=
PTK_GOOGLE_OAUTH_CLIENT_SECRET=
```

`engine/.env.local` đã bị Git ignore. Sau khi tạo hoặc sửa file, tắt rồi chạy lại PTK để process nhận biến mới. OAuth vẫn cần Google login; biến client không thay thế tài khoản Google.

Máy hiện tại đã có giá trị local từ lần cấu hình trước thì giữ nguyên; không cần điền lại khi `git pull`. Repo không phân phối sẵn OAuth client Google. Nếu máy mới thiếu các giá trị phù hợp, luồng Google OAuth/refresh chưa sẵn sàng; dùng thiết lập client được provider hỗ trợ. Không tự tạo client bất kỳ rồi giả định quyền truy cập upstream sẽ giống nhau.

### Nhập tài khoản từ router cũ

1. Trong Thiết lập local, tìm **Nhập tài khoản từ router cũ trên máy**.
2. Bấm **Xem nguồn** để xem số tài khoản theo provider.
3. Chọn Codex và/hoặc Antigravity, rồi **Nhập tài khoản đã chọn**.
4. Kiểm tra số đã nhập/bỏ qua và đường dẫn snapshot trong kết quả.
5. Dừng router cũ trước khi bật các tài khoản nhập ở **Providers**.

Nguồn tự phát hiện là `%APPDATA%\9router\db\data.sqlite`; UI chỉ hiện khi có file này. PTK đọc database nguồn, không đổi nguồn. Import sao chép credential được chọn, bỏ qua tài khoản trùng theo provider và email/tên; tài khoản mới ở trạng thái **TẮT** để tránh hai router cùng xoay refresh token. Key app, log chat, hosts, proxy và trạng thái cooldown không được nhập theo.

Nếu nguồn nằm ở đường dẫn khác, bản này chưa có form chọn database tùy ý. Thêm kết nối mới trong Providers thay vì chỉnh SQLite thủ công. Import cần runtime Node 22.13+ có `node:sqlite`.

<a id="codex"></a>

## 6. Kết nối Codex

1. Mở **CLI Tools → Codex**.
2. Chọn endpoint `http://127.0.0.1:21000/v1` và key `PTK · Codex`.
3. Chọn model dạng `cx/<model-id>` rồi Apply.
4. Mở một chat Codex mới để kiểm tra.

PTK sửa `%USERPROFILE%\.codex\config.toml` và tạo backup `config.toml.ptk-backup-<timestamp>`. `auth.json` không bị sửa. Nếu muốn hoàn tác, dùng **Reset** trong CLI Tools hoặc khôi phục file backup.

Đây là tích hợp cấu hình local. File mặc định là `%USERPROFILE%\.codex\config.toml`; nếu app dùng `CODEX_HOME` khác, công cụ PTK hiện vẫn ghi vào đường dẫn mặc định, cần đối chiếu đúng thư mục app đang đọc.

PTK ghi provider `ptk`, `wire_api = "responses"`, `requires_openai_auth = false` và header Authorization chứa key PTK. Backup `config.toml` vì file này có thể chứa key tĩnh. Nút Reset gỡ lựa chọn/section PTK, giữ section provider khác và không khôi phục nguyên trạng toàn bộ file; dùng backup nếu muốn phục hồi đầy đủ.

Theo [OpenAI Docs về cấu hình nâng cao](https://learn.chatgpt.com/docs/config-file/config-advanced), cấu hình provider đặt ở user config. Bản Codex hiện tại bỏ qua `model_provider` và `model_providers` trong project config; project tin cậy vẫn có thể ghi đè một số giá trị như model. Khi đổi provider, kiểm tra user config, profile được chọn và chat mới; không giả định mọi chat cũ tự chuyển. Xem Usage để biết request thực tế.

<a id="cursor"></a>

## 7. Kết nối Cursor

Cursor cần hỗ trợ BYOK/custom OpenAI endpoint ở phiên bản và gói hiện tại.

1. Mở Cursor Settings → Models/AI.
2. Bật custom OpenAI API key hoặc BYOK.
3. Base URL: `http://127.0.0.1:21000/v1`.
4. API key: key `PTK · Cursor AG`.
5. Thêm model chính xác, ví dụ `ag/gemini-3.8-flash-high`.
6. Gửi một prompt ngắn rồi xem **Usage** trong PTK.

Cursor có thể yêu cầu tên model được cho phép trong tài khoản Cursor. PTK chỉ định tuyến request nhận được; nó không cấp gói trả phí của Cursor. Không bật DNS MITM cho Cursor.

<a id="antigravity"></a>

## 8. Kết nối Antigravity desktop qua MITM

MITM cần quyền Administrator vì phải cài CA và quản lý hosts/DNS. Trước khi bắt đầu, tắt MITM của router khác nếu đang giữ port 443.

1. Đóng Antigravity.
2. Mở `start.cmd` bằng **Run as administrator**.
3. Vào **MITM**.
4. Chọn key `PTK · Antigravity`, router base `http://127.0.0.1:21000` và kiểm tra Cert/Trusted/Server.
5. Bấm Start MITM.
6. Bật DNS cho Antigravity.
7. Mở Antigravity, đăng nhập Google nếu app yêu cầu, gửi một prompt ngắn.
8. Xem Usage để xác nhận model/provider/account.

PTK chỉ quản lý các dòng hosts có marker `# PTK-Proxy-Tools`. Để về direct, **Disable DNS** rồi **Stop MITM** trước khi đóng PTK. Stop MITM cũng có bước gỡ DNS do PTK quản lý; kiểm tra trạng thái sau thao tác. Router cũ phải được tắt chuyển hướng bằng công cụ của router đó. Không chạy hai MITM trên port 443.

Hai domain Antigravity được chuyển hướng là `daily-cloudcode-pa.googleapis.com` và `cloudcode-pa.googleapis.com`. Quy tắc hosts áp dụng trên máy nên có thể tác động app khác gọi cùng domain. OAuth login vẫn do app xử lý; một số request được passthrough tới Google. Muốn xác nhận inference đi qua PTK, gửi một prompt rồi xem Usage cùng thời điểm và provider `ag`.

### Khi thêm model mới

1. Xác nhận model đã có trong provider và tài khoản được quyền gọi.
2. Kiểm tra ánh xạ ở trang MITM: model tên app gửi phải trỏ tới `ag/<model-id>`.
3. Với model đã được khai báo trong catalog của bản source, nút đồng bộ profile tạo/cập nhật các ánh xạ tương ứng.
4. Key `ag/*` đã cho phép model mới cùng provider; nếu key đang giới hạn từng model cụ thể, bổ sung ID tại Endpoint & Key.

Tên hiển thị trong app không nhất thiết trùng ID API. Sử dụng ID provider/ánh xạ hiển thị trong dashboard, không đoán từ tên marketing.

### DNS Antigravity

`google-doh` dùng `https://dns.google/resolve` để tránh lỗi DNS UDP. Tên miền upstream được gửi tới Google DNS. Đây là DNS của proxy MITM, không đổi DNS toàn Windows. Có thể chọn `system` trong Thiết lập local rồi restart PTK.

### CA và đăng nhập

CA local có tên **PTK Proxy Tools MITM Root CA**. Nếu Antigravity báo lỗi chứng chỉ, kiểm tra Cert/Trusted trong trang MITM và mở lại app. MITM không thay thế Google login; app có thể yêu cầu đăng nhập lại sau khi đổi proxy hoặc xóa phiên.

<a id="routing"></a>

## 9. Nối router hoặc proxy khác

Vào **Providers** hoặc **Proxy Pools** tùy loại kết nối:

- **Custom AI endpoint:** thêm provider OpenAI-compatible/Anthropic-compatible, prefix riêng và API key của router đích. Client gọi `prefix/model-id`.
- **Proxy Pool:** thêm HTTP/SOCKS proxy để kết nối ra upstream. Đây là proxy mạng, không phải API endpoint.
- **Combo:** thêm nhiều model/prefix theo thứ tự fallback hoặc round-robin. Cấp quyền combo riêng cho key nếu muốn dùng combo.

Không trỏ upstream về chính PTK, vì sẽ tạo vòng request. Không cấp combo trộn provider cho key cần tách Codex và Antigravity.

### Ví dụ nối router local thứ hai

Giả sử router đích có API `http://127.0.0.1:22000/v1` và model `example-model`:

| Trường | Giá trị mẫu |
| --- | --- |
| Tên | Router local phụ |
| Type | OpenAI-compatible |
| Prefix | `local2` |
| API type | `chat` hoặc `responses` đúng theo API router đích |
| Base URL | `http://127.0.0.1:22000/v1` |
| Credential | Key của router đích trong kết nối provider |
| Model client gọi | `local2/example-model` |

Tạo key PTK riêng và cho phép `local2/*` nếu muốn app sử dụng router này. Ba profile mặc định chỉ được `cx/*` hoặc `ag/*` nên không tự có quyền `local2/*`. Test một prompt ngắn rồi đối chiếu log ở cả PTK và router đích.

### Combo fallback và pool tài khoản

Pool tài khoản chọn connection trong một provider; combo chọn giữa nhiều model. Hai cơ chế có thể kết hợp nhưng phục vụ hai mục đích khác nhau.

1. Vào **Combo & Vision Adapter**, tạo combo tên `ag-backup`.
2. Thêm các model `ag/...` đang có quyền, đặt model ưu tiên trước.
3. Chọn **Fallback** để thử theo thứ tự, hoặc **Round Robin** để xoay model.
4. Thêm tên `ag-backup` vào allow list của key cần dùng; client gửi `model = "ag-backup"`.

Combo được cấp quyền theo tên. Khi cho phép combo, toàn bộ model thành viên của combo có thể được gọi qua nó; việc sửa thành viên cũng làm thay đổi phạm vi sử dụng. Request lỗi upstream vẫn có thể đã phát sinh usage/chi phí, fallback không bảo đảm request chưa bị tính phí.

### Usage, quota và Token Saver

Usage lưu request/token và chi phí theo bảng giá local; Quota Tracker lấy số liệu do provider cung cấp. Hai số liệu có thể khác nhau, không dùng chi phí ước tính local thay hóa đơn upstream. Tài khoản import đang tắt không bị PTK hỏi quota/refresh qua luồng đã kiểm thử.

Token Saver có thể thay đổi prompt hoặc cắt/nén nội dung. Khi bật adapter cần binary/service ngoài, cài dependency được UI yêu cầu trước; nếu lỗi, tắt adapter rồi kiểm tra request cơ bản. Khả năng ảnh/audio/PDF/video tùy translator và model, không suy ra mọi khả năng đều hoạt động chỉ vì UI có mục đó.

<a id="configuration"></a>

## 10. Cấu hình, backup và reset

### `ptk.config.json`

```json
{
  "port": 21000,
  "dataDir": "data/engine",
  "mitmDns": "google-doh"
}
```

| Trường | Giá trị và cách áp dụng |
| --- | --- |
| `port` | Số nguyên 1024–65535. Lưu trong Thiết lập local hoặc sửa JSON; restart PTK, cập nhật base URL các app/MITM |
| `dataDir` | Đường dẫn tuyệt đối hoặc tương đối so với thư mục gốc PTK. Sửa file khi server đã dừng; di chuyển/restore dữ liệu thủ công nếu cần |
| `mitmDns` | `system` hoặc `google-doh`. Restart PTK và MITM để process mới nhận chế độ DNS |

Sửa JSON cần đúng dấu phẩy và dấu ngoặc; dùng `/` hoặc `\\` trong đường dẫn Windows. Không thêm credential vào file này. Thay key/quyền/alias/combo qua dashboard thường có hiệu lực với request tiếp theo; thay port/DNS/dataDir cần restart, không cần build lại.

Các file chính:

| File/thư mục | Nội dung |
| --- | --- |
| `ptk.config.json` | Port, `dataDir`, `mitmDns` |
| `data/engine/db/data.sqlite` | Provider, key, alias, combo, usage |
| `data/engine/backups/` | Snapshot trước import/profile |
| `data/engine/mitm/` | CA, alias cache, trạng thái MITM |
| `data/engine/auth/` | Secret xác thực CLI |
| `data/engine/jwt-secret` | Secret ký phiên dashboard nếu không đặt `JWT_SECRET` |
| `engine/.env.local` | OAuth client local, không commit |

Dừng MITM/DNS và PTK trước khi sao lưu. Sao chép cả `data/engine`, `ptk.config.json` và `engine/.env.local` nếu có sang nơi riêng. Không chỉnh SQLite khi server đang chạy. Khi restore, giữ đường dẫn `dataDir` hoặc sửa lại trong `ptk.config.json`; khởi động PTK và kiểm tra profiles/provider trước khi bật MITM.

Snapshot JSON trong `data/engine/backups` là bản export trước một số thao tác, không thay thế bản sao toàn bộ thư mục (CA, secret, file env nằm ngoài export). Dữ liệu local và backup có credential, không được mã hóa toàn bộ; giữ riêng và không push GitHub.

Để reset dữ liệu app với đường dẫn mặc định, Disable DNS, Stop MITM và dừng PTK, rồi đổi tên `data/engine` thành `data/engine.backup-<date>`. Lần chạy sau PTK tạo data mới; mật khẩu ban đầu là `123456` trừ khi đặt `INITIAL_PASSWORD`. File env và chứng chỉ đã cài vào Windows vẫn tồn tại; đây không phải thao tác gỡ sạch toàn bộ tích hợp. Bản backup cũ vẫn còn để khôi phục.

<a id="cli"></a>

## 11. CLI quản trị

Mở terminal thứ hai trong thư mục dự án:

```powershell
npm run cli -- help
npm run cli -- health
npm run cli -- config
npm run cli -- profiles
npm run cli -- doctor
npm run cli -- bootstrap
```

`doctor` kiểm tra port, DNS và domain upstream. `bootstrap` đồng bộ ba profile. CLI đọc secret local trong `data/engine`; không copy secret đó sang máy khác và không dán output có key vào nơi công khai.

`config` chỉ in vị trí file/data/dashboard. `health` cần server đang chạy. Các lệnh quản trị còn lại dùng secret của dataDir hiện tại; nếu báo thiếu `machine-id` hoặc `cli-secret`, mở dashboard và đăng nhập rồi vào Thiết lập local ít nhất một lần. `bootstrap` có thể in key mới, không đưa output đó lên issue.

<a id="troubleshooting"></a>

## 12. Chẩn đoán lỗi

| Lỗi | Cách kiểm tra |
| --- | --- |
| `node` quá cũ | Cài Node 22.13+; mở PowerShell mới; kiểm tra `node --version` |
| Port 21000 đang dùng | Xác định process đang dùng port, dừng đúng app hoặc đổi `ptk.config.json` rồi chạy lại; không cần build |
| `401 Invalid API key` | Dùng key đang bật trong Endpoint & Key; kiểm tra base URL có `/v1` |
| `403 model not allowed` | Model phải đúng scope: `cx/...`, `ag/...`, hoặc combo đã cấp quyền |
| `403` có `not allowed to use model` | Đây là chặn quyền key local, kể cả mã `insufficient_quota`; kiểm tra allow list và prefix trước |
| `429`/quota/billing từ upstream | Xem message nguồn và connection được chọn; quota và quyền tài khoản upstream độc lập với scope local |
| Antigravity mất mạng | Stop DNS nếu muốn direct; nếu dùng PTK, kiểm tra MITM server và port 443 |
| Lỗi chứng chỉ | Cài/Trust CA trong MITM, rồi đóng mở lại Antigravity |
| DNS UDP timeout | Chọn `google-doh`, restart PTK và Start MITM lại |
| Cursor không gọi được | Kiểm tra BYOK/custom endpoint, key Cursor AG và model `ag/...` |
| Codex vẫn dùng provider cũ | Dùng chat mới; kiểm tra user config/profile, model trong project, `CODEX_HOME` và Usage |
| OAuth không mở | Điền `engine/.env.local`, restart PTK, kiểm tra đồng hồ hệ thống và trình duyệt |
| Dashboard không mở | Kiểm tra cửa sổ `npm start`, `npm run cli -- health`, và port 21000 |

Không gửi access token, refresh token, API key hoặc database lên issue. Khi cần báo lỗi, gửi mã HTTP, model prefix, thời điểm và log đã che credential.

### Kiểm tra port và hosts bằng PowerShell

Các lệnh sau chỉ đọc trạng thái:

```powershell
Test-NetConnection 127.0.0.1 -Port 21000
Test-NetConnection 127.0.0.1 -Port 443
Get-NetTCPConnection -State Listen -LocalPort 21000,443 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess

Get-Content "$env:SystemRoot\System32\drivers\etc\hosts" |
  Select-String 'PTK-Proxy-Tools|daily-cloudcode-pa|cloudcode-pa'
```

`TcpTestSucceeded = True` chỉ chứng minh có process nghe port, không chứng minh đó là PTK hoặc CA đúng. Dùng `/api/health`, trang MITM và Usage để xác nhận tiếp. Domain trỏ về `127.0.0.1` nhưng MITM443 tắt sẽ gây mất kết nối; khôi phục qua router đã tạo dòng hosts.

### Thao tác DNS báo `apiKey is not defined`

Nếu bản source hiện tại trả lỗi này khi bật/tắt DNS, đó là lỗi handler quản lý DNS, không phải tài khoản Google hoặc quota. Không đăng nhập lại liên tục để xử lý lỗi đó. Dừng MITM qua trang MITM để chạy bước gỡ các DNS PTK, kiểm tra hosts còn marker hay không và dùng kết nối trực tiếp trong lúc chờ sửa handler. Không xóa cả file hosts hoặc các dòng của phần mềm khác.

<a id="testing"></a>

## 13. Kiểm thử nhà phát triển

```powershell
npm run check
npm test
npm run test:engine
```

Smoke test dùng data và port riêng:

```powershell
npm run smoke:start
# terminal khác
npm run test:smoke
```

Smoke fixture chỉ dùng credential giả và nghe tại `127.0.0.1:21009`, với data/home/AppData riêng trong `data/smoke-isolated`. Không đặt `PTK_SMOKE_URL` sang server có tài khoản thật. Kết quả lưu ở `data/verification/smoke.json`; dừng fixture bằng `Ctrl+C` sau khi xong. `npm test` kiểm tra gateway thử nghiệm cũ; `test:engine` là suite engine chọn lọc, không phải toàn bộ test upstream.

<a id="uninstall"></a>

## 14. Gỡ cài đặt hoặc hoàn tác tích hợp

1. Với Antigravity: Disable DNS, Stop MITM, rồi đóng PTK.
2. Với Codex: CLI Tools → Codex → Reset, hoặc khôi phục backup `config.toml.ptk-backup-*`.
3. Với Cursor: xóa custom endpoint/key PTK trong Settings.
4. Kiểm tra hosts đã bỏ các dòng chuyển hướng do PTK tạo trước khi xóa source/data. Nếu không còn dùng CA PTK, mở `certmgr.msc` hoặc công cụ certificate Windows và gỡ đúng **PTK Proxy Tools MITM Root CA** khỏi store đã cài; giữ chứng chỉ của phần mềm khác.
5. Dừng PTK rồi xóa thư mục dự án nếu không cần nữa. Giữ bản sao riêng của `data/engine`, `ptk.config.json` và `engine/.env.local` nếu muốn khôi phục.

<a id="api"></a>

## 15. Gọi API từ PowerShell

Health không cần key; API inference cần key PTK đang bật. Dùng base URL cùng port đang cấu hình, không thêm `/v1` hai lần.

Ví dụ này nhập key qua ô ẩn để không ghi key thật vào dòng lệnh:

```powershell
$ptkBase = 'http://127.0.0.1:21000'
Invoke-RestMethod -Uri "$ptkBase/api/health"

$ptkSecureKey = Read-Host 'Key PTK cho app cần kiểm tra' -AsSecureString
$ptkKey = [System.Net.NetworkCredential]::new('', $ptkSecureKey).Password
$ptkHeaders = @{ Authorization = "Bearer $ptkKey" }
Invoke-RestMethod -Uri "$ptkBase/v1/models" -Headers $ptkHeaders
```

Chat Completions, dùng key có quyền `ag/*` và một model đã có trong provider:

```powershell
$ptkBody = @{
  model = 'ag/gemini-3.8-flash-medium'
  messages = @(@{ role = 'user'; content = 'Say hello in one sentence.' })
  stream = $false
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$ptkBase/v1/chat/completions" `
  -Method Post -Headers $ptkHeaders -ContentType 'application/json' -Body $ptkBody
```

Responses, nhập lại key `PTK · Codex` bằng đoạn nhập key ở trên rồi thay `<model-id>` bằng ID trong dashboard:

```powershell
$ptkBody = @{
  model = 'cx/<model-id>'
  input = 'Reply with one short sentence.'
  stream = $false
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "$ptkBase/v1/responses" `
  -Method Post -Headers $ptkHeaders -ContentType 'application/json' -Body $ptkBody
```

Nếu muốn streaming, client cần đọc SSE; hai ví dụ trên dùng `stream = false` để xem kết quả dễ hơn. Lệnh inference thật có thể tiêu thụ quota của tài khoản. Kết thúc bằng cách đóng terminal hoặc xóa biến key khỏi session; không in `$ptkKey` hay `$ptkHeaders` lên màn hình khi chia sẻ log.

<a id="updates"></a>

## 16. Cập nhật mã nguồn

1. Disable DNS, Stop MITM và dừng PTK.
2. Sao lưu data, file env và `ptk.config.json` như mục 10.
3. Kiểm tra thay đổi local trước khi kéo code.

```powershell
git status --short
git pull --ff-only
npm run setup
npm run build
npm start
```

Chỉ tiếp tục lệnh sau nếu lệnh trước thành công. Nếu `git pull` báo xung đột, giữ thay đổi local rồi xử lý trước; không dùng `reset --hard` để vượt qua. `setup`/`build` cần mạng hoặc cache dependency phù hợp; cập nhật docs đơn thuần không bắt buộc build lại.

File `.env.local` và data bị Git ignore nên không được khôi phục chỉ bằng clone repository. Thay đổi theo dõi trong `ptk.config.json` có thể xung đột với phiên bản mới; đối chiếu port/dataDir của máy trước khi chạy lại. Bản local tắt updater package/cloud; cập nhật theo source repository này.

<a id="limits"></a>

## 17. Giới hạn và mức kiểm chứng

- Bản này ưu tiên loopback trên Windows. Chưa có hướng dẫn triển khai LAN/Internet/tunnel; các nút deploy cloud và updater upstream bị tắt trong chế độ local.
- Fixture kiểm chứng phân quyền provider, import tài khoản ở trạng thái tắt, chuyển đổi Chat/Responses, streaming, combo fallback và usage với upstream giả. Nó không xác nhận quyền truy cập model thật của tài khoản.
- OAuth thật, quota thật, Cursor BYOK và mọi đường HTTPS của Antigravity cần kiểm tra riêng trên app/tài khoản đang sử dụng. Health thành công không thay thế kiểm tra một prompt và Usage.
- Model catalog/mapping trong repo có thể đi trước hoặc khác quyền tài khoản. Prefix đúng không tự cấp quota hoặc gói thuê bao.
- MITM Cursor của engine chưa hoàn chỉnh. Với Cursor, dùng custom endpoint nếu phiên bản/gói cho phép.

Thông tin nguồn fork và giấy phép MIT nằm trong `UPSTREAM.json`, `THIRD_PARTY_NOTICES.json` và `engine/LICENSE`.
