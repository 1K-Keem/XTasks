# XTasks - Task Management & Visualization Platform

XTasks là một ứng dụng quản lý công việc hiện đại kết hợp danh sách phân cấp và trực quan hóa không gian nút (node visualization). Ứng dụng cho phép bạn tạo, quản lý, và hình dung mối quan hệ giữa các công việc một cách trực quan.

## Tính Năng

### 👤 Xác Thực & Bảo Mật
- Đăng ký tài khoản mới
- Đăng nhập an toàn với NextAuth.js v5
- Xác thực dựa trên JWT
- Mật khẩu được mã hóa bcryptjs

### 📋 Quản Lý Task
- **Cấu trúc phân cấp**: Root task và subtask không giới hạn cấp độ
- **Thêm**: Tạo root task mới hoặc subtask
- **Chỉnh sửa**: Đổi tên, mô tả, đánh dấu hoàn thành
- **Xóa**: Xóa task (tất cả subtask cũng bị xóa)
- **Lưu tự động**: Tất cả thay đổi đều lưu vào cơ sở dữ liệu

### 📊 Hai Chế Độ Làm Việc

#### 1. List View (Danh sách)
- Hiển thị task theo cây phân cấp
- Đánh dấu hoàn thành/chưa hoàn thành
- Thêm/xóa task nhanh
- Chỉnh sửa mô tả task

#### 2. Visualization View (Bản đồ node)
- Kéo-thả node task trên workspace
- Lưu vị trí của từng task
- Tạo liên kết phụ thuộc giữa các task
- Xem mối quan hệ giữa các công việc
- Context menu (chuột phải) để:
  - Thêm task mới tại vị trí cụ thể
  - Clear all (xóa tất cả task)

### 💾 Lưu Trữ & Persistence
- **Task data**: Lưu tiêu đề, mô tả, trạng thái hoàn thành
- **Vị trí node**: Lưu tọa độ x, y của từng task trên workspace
- **Liên kết task**: Lưu mối quan hệ phụ thuộc giữa các task
- **Dữ liệu người dùng**: Riêng biệt cho mỗi user (multi-tenant)

## Công Nghệ Sử Dụng

### Frontend
- **Next.js 14.2.35** - React framework
- **React 18** - UI library
- **TypeScript** - Kiểu an toàn
- **Tailwind CSS 3** - Styling
- **NextAuth.js v5** - Xác thực

### Backend
- **Next.js API Routes** - REST API
- **Prisma 5** - ORM
- **PostgreSQL** - Cơ sở dữ liệu
- **bcryptjs** - Mã hóa mật khẩu

## Yêu Cầu Hệ Thống

- Node.js 20+ (LTS)
- npm 10+
- PostgreSQL 12+

## Cài Đặt PostgreSQL

1. Tải PostgreSQL từ [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Chạy installer, chọn phiên bản 12 trở lên
3. Trong quá trình cài đặt:
   - Đặt mật khẩu cho user `postgres` (ghi nhớ mật khẩu này)
   - Port mặc định: `5432`
   - Locale: `English, United States`
4. Hoàn thành cài đặt

## Tạo Database & User
Mở terminal và chạy:
```bash
psql -U postgres
```
Sau đó chạy các lệnh SQL:

```sql
-- Tạo database
CREATE DATABASE xtasks;

-- Tạo user (optional - sử dụng postgres có thể dùng luôn)
CREATE USER xtasks_user WITH PASSWORD 'your_password_here';

-- Cấp quyền
GRANT ALL PRIVILEGES ON DATABASE xtasks TO xtasks_user;

-- Thoát
\q
```

## Cài Đặt

### 1. Clone Repository
```bash
git clone <repo-url>
cd ass
```

### 2. Cài Đặt Dependencies
```bash
npm install
```

### 3. Cấu Hình Môi Trường
Tạo file `.env` (hoặc `.env.local`) với nội dung:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/xtasks"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Khởi Tạo Cơ Sở Dữ Liệu
```bash
npx prisma db push
```

### 5. Chạy Development Server
```bash
npm run dev
```

Ứng dụng sẽ mở tại: **http://localhost:3000**

> **Lưu ý**: Script `dev` tự động xóa các tiến trình trên port 3000-3003 trước khi khởi động

## Deployment

### Build for Production
```bash
npm run build
npm run start
```

## Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── api/
│   │   ├── auth/               # NextAuth endpoints
│   │   └── tasks/              # Task API endpoints
│   ├── login/                  # Trang đăng nhập
│   ├── signup/                 # Trang đăng ký
│   ├── page.tsx                # Trang chủ (app)
│   └── layout.tsx              # Layout chính
├── components/
│   ├── XTasksApp.tsx           # Component chính quản lý task
│   ├── TaskList.tsx            # List view component
│   └── TaskGraph.tsx           # Visualization component
├── lib/
│   ├── auth.ts                 # NextAuth configuration
│   └── prisma.ts               # Prisma client
└── types/
    └── styles.d.ts             # CSS modules type definitions
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Đăng ký tài khoản
- `POST /api/auth/signin/credentials` - Đăng nhập

### Tasks
- `GET /api/tasks` - Lấy tất cả task của user
- `POST /api/tasks` - Tạo task mới
- `PUT /api/tasks/[id]` - Cập nhật task (tiêu đề, mô tả, trạng thái)
- `DELETE /api/tasks/[id]` - Xóa task

### Visualization
- `GET /api/tasks/positions` - Lấy vị trí các node
- `PUT /api/tasks/positions` - Lưu vị trí các node
- `GET /api/tasks/links` - Lấy các liên kết task
- `POST /api/tasks/links` - Tạo liên kết mới
- `DELETE /api/tasks/links` - Xóa liên kết

## Sử Dụng

### Đăng Ký & Đăng Nhập
1. Truy cập trang signup để tạo tài khoản
2. Nhập email, mật khẩu, tên (tùy chọn)
3. Đăng nhập với tài khoản vừa tạo

### Quản Lý Task - List View
1. Nhấn nút **+** để thêm root task
2. Nhập tiêu đề task
3. Các thao tác:
   - ✓ Đánh dấu hoàn thành
   - ➕ Thêm subtask
   - 🗑️ Xóa task
   - 📝 Chỉnh sửa mô tả
   - 🔽 Collapse/expand

### Quản Lý Task - Visualization View
1. Kéo node để di chuyển vị trí (tự động lưu)
2. Kéo từ điểm nối để tạo liên kết giữa task
3. Chuột phải trên workspace:
   - Thêm task tại vị trí
   - Clear all
4. Vị trí và liên kết được lưu tự động

## Ghi Chú

- Mỗi user chỉ thấy được task của chính mình
- Đăng xuất sẽ xóa session nhưng giữ lại tất cả dữ liệu task
- Đăng nhập lại sẽ hiển thị các task đã lưu trước đó
- Xóa tất cả task từ database (clear all)
- Node positions và links tự động lưu khi kéo hoặc tạo

## License

MIT

## Cấu trúc thư mục chính

```text
src/
	app/
		layout.tsx
		page.tsx
		globals.css
	components/
		XTasksApp.tsx
```

## Lưu ý hiện tại

- Dữ liệu đang được quản lý ở client state (chưa có backend/database).
- Chưa có chức năng đăng nhập, phân quyền, đồng bộ đa thiết bị.
- Mục tiêu hiện tại là prototype UX/UI và luồng thao tác.

## Định hướng phát triển

- Lưu trữ dữ liệu bền vững (database + API).
- Hệ thống tài khoản và chia sẻ task/team workspace.
- Realtime collaboration.
- Tìm kiếm/lọc task nâng cao và analytics tiến độ.

## License

MIT