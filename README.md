# XTasks

XTasks là ứng dụng quản lý công việc theo mô hình flow graph: quản lý task theo dependency, theo dõi critical path, cộng tác theo project/team và thao tác trực quan trên canvas.

## Tính năng chính

- Đăng ký/đăng nhập bằng email + password.
- Quản lý nhiều project theo vai trò:
	- Owner
	- Lead
	- Member
- Mời thành viên qua email và xử lý lời mời.
- Giao nhiều assignee cho một task.
- Quản lý task trên canvas:
	- Kéo thả node.
	- Tạo/xóa dependency bằng edge.
	- Auto layout theo DAG/dependency.
	- Context menu chuột phải (theo quyền).
- CPM/critical path và progress theo trọng số duration.
- Realtime cập nhật trong project qua SSE.
- Khóa interaction toàn project:
	- Đồng bộ realtime cho mọi thành viên.
	- Chỉ owner/lead bật/tắt.
	- Khi lock: chặn tạo task/dependency, chặn drag và delete.
	- Vẫn cho mở task để đọc và toggle done theo rule hiện tại.
- Hỗ trợ dark mode.

## Tech stack

- Next.js 14 (App Router)
- React 18 + TypeScript
- Prisma ORM
- SQLite (local)
- NextAuth
- React Flow (@xyflow/react)
- Tailwind CSS

## Yêu cầu môi trường

- Node.js 20 LTS (khuyến nghị)
- npm 9+
- Windows/macOS/Linux

## Clone và chạy trên máy mới

### 1. Clone source

```bash
git clone https://github.com/1K-Keem/XTasks.git
cd XTasks
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Cấu hình môi trường nội bộ

Dự án này dùng nội bộ, file .env đã được quản lý sẵn theo môi trường làm việc của team.

Nếu bạn clone từ nguồn nội bộ chính thức, không cần tự tạo .env thủ công.

### 4. Chạy migration database

```bash
npx prisma migrate deploy
```

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Chạy ứng dụng

```bash
npm run dev
```

Mở trình duyệt: http://localhost:3000

## Luồng chạy nhanh (dev local)

Nếu đã setup xong trước đó:

```bash
npm run dev
```

## Build production local

```bash
npm run build
npm run start
```

## Scripts

- `npm run dev`: chạy development server
- `npm run build`: build production
- `npm run start`: chạy bản build
- `npm run lint`: lint code

## Cấu trúc thư mục chính

```text
prisma/
	schema.prisma
	migrations/

src/
	app/
		api/
			auth/
			invitations/
			projects/
			tasks/
		dashboard/
		login/
		signup/
	components/
		flow/
	lib/
```

## Troubleshooting

### 1. `npm run dev` bị treo hoặc hành vi lạ

Thử reset local state:

```bash
# dừng hết server đang chạy
# xóa cache Next
rm -rf .next

# reset db local
npx prisma migrate reset --force --skip-seed

# generate lại prisma client
npx prisma generate

# chạy lại
npm run dev
```

Trên Windows, nếu `rm -rf` không dùng được thì xóa `.next` bằng File Explorer hoặc PowerShell `Remove-Item -Recurse -Force .next`.

### 2. Lỗi Prisma `EPERM ... query_engine-windows.dll.node`

- Đảm bảo đã tắt mọi terminal/dev server trước khi `prisma generate`.
- Chạy lại `npx prisma generate`.

### 3. Port 3000 đã được dùng

Next.js sẽ tự chuyển sang port khác (vd: 3001). Nếu muốn cố định, hãy dừng process đang chiếm port 3000 trước.

## License

MIT