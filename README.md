# XTasks

XTasks là một ứng dụng quản lý công việc theo mô hình node (nút), giúp bạn vừa quản lý danh sách task, vừa quan sát quan hệ giữa các task trong không gian trực quan.

Project hiện là prototype chạy local bằng Next.js + React + TypeScript, tập trung vào trải nghiệm tương tác và visual hóa.

## Demo chức năng hiện có

- Quản lý task theo cây (root task và subtask nhiều cấp).
- 2 chế độ làm việc:
	- List: quản lý dạng danh sách phân cấp.
	- Visualize: quản lý bằng node kéo-thả trên workspace.
- Đổi tên task inline bằng cách click vào tên task.
- Mô tả task (description) hiển thị qua hover card và chỉnh sửa khi click.
- Tạo liên kết phụ thuộc (dependency) giữa các root task bằng thao tác kéo từ điểm nối.
- Cửa sổ tab con cho từng task cha để thao tác nhanh subtask.
- Xóa task, thêm task con, đánh dấu hoàn thành.
- Context menu trong workspace (chuột phải) để thêm task mới / clear all.

## Công nghệ sử dụng

- Next.js 14
- React 18
- TypeScript
- CSS (global styling)

## Yêu cầu môi trường

- Node.js 18+ (khuyến nghị Node.js 20 LTS)
- npm 9+

## Cài đặt và chạy local

```bash
npm install
npm run dev
```

Mở trình duyệt tại:

```text
http://localhost:3000
```

## Build production

```bash
npm run build
npm run start
```

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