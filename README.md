# Todo Planner

Todo Planner คือเว็บแอปพลิเคชันสำหรับจัดการงานและวางแผนงานประจำวันแบบ Responsive รองรับการใช้งานทั้งบนคอมพิวเตอร์ แท็บเล็ต และสมาร์ตโฟน พัฒนาด้วย React 19, TypeScript และ Vite สำหรับฝั่ง Frontend ร่วมกับ Express.js และ PostgreSQL สำหรับฝั่ง Backend API

---

## ฟีเจอร์สำคัญ

- **กระดานงานแบบ Kanban (Multi-Board)**: รองรับการสร้างหลายบอร์ด ปรับแต่งคอลัมน์ และลากวางการ์ดย้ายสถานะงาน (Drag and Drop)
- **ปฏิทินวางแผนงานหลายมุมมอง (Calendar Multi-Views)**: รองรับมุมมองรายเดือน (Month), รายสัปดาห์ 7 วัน (Week), ไทม์ไลน์รายวัน (Day) และรายการตามลำดับเวลา (Agenda)
- **ระบบเสียงแจ้งเตือนและการอัดเสียง (Sound & Voice Recording)**: มีเสียงเอฟเฟกต์สังเคราะห์ให้เลือก 5 รูปแบบ และรองรับการอัดเสียงพูดของตนเองผ่านไมโครโฟนเพื่อใช้เป็นเสียงแจ้งเตือนเมื่องานเสร็จ
- **การจัดการพื้นที่จัดเก็บและบีบอัดรูปภาพ (Safe Storage)**: มีระบบบีบอัดภาพอัตโนมัติก่อนจัดเก็บ และสำรองข้อมูลลงใน IndexedDB เพื่อป้องกันปัญหาพื้นที่เบราว์เซอร์เต็ม (QuotaExceededError)
- **หน้าวิเคราะห์สถิติ (Analytics Dashboard)**: แสดงอัตราความสำเร็จ กราฟแท่งรายสัปดาห์ และประวัติการทำงานต่อเนื่อง (Streak)
- **ระบบสำรองและกู้คืนข้อมูล (Backup & Restore)**: Export และ Import ข้อมูลทั้งหมดในรูปแบบไฟล์ JSON
- **การปรับแต่งรูปลักษณ์ (Theme & Language)**: รองรับโหมดมืด (Dark Mode), โหมดสว่าง (Light Mode), การเลือกสี Accent Color และรองรับ 2 ภาษา (ไทย และ อังกฤษ)

---

## เทคโนโลยีที่ใช้

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS, Lucide React, Web Audio API, MediaRecorder API, IndexedDB, LocalStorage
- **Backend**: Node.js, Express.js, PostgreSQL (`pg`), CORS, dotenv
- **Database**: PostgreSQL

---

## โครงสร้างโปรเจกต์

```text
workspace/todo-list-app/
├── database/
│   └── todo.sql              # สคริปต์สร้างตารางฐานข้อมูล PostgreSQL
├── server/
│   ├── index.js              # Express API Server
│   ├── package.json          # Dependencies ของ Backend
│   └── .env                  # การตั้งค่า Environment Variables ของ Backend
├── todo_list/
│   ├── src/
│   │   ├── components/       # คอมโพเนนต์และสไตล์หลัก (TodoList.tsx, TodoList.css)
│   │   ├── contexts/         # Context สำหรับ Theme และ Language
│   │   ├── hooks/            # Custom Hooks
│   │   ├── locales/          # ไฟล์ภาษา th.json และ en.json
│   │   └── utils/            # storageHelper.ts และ soundManager.ts
│   └── package.json          # Dependencies และ Scripts ของ Frontend
└── README.md
```

---

## ขั้นตอนการติดตั้งและรันโปรเจกต์

### 1. ติดตั้ง Dependencies

```bash
# ติดตั้ง Backend
cd server
npm install

# ติดตั้ง Frontend
cd ../todo_list
npm install
```

### 2. เตรียมฐานข้อมูล

สร้างฐานข้อมูล PostgreSQL แล้วรันสคริปต์ในไฟล์ `database/todo.sql`

### 3. กำหนดค่า Environment Variables

สร้างไฟล์ `server/.env`:

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=todo_app
DB_PASSWORD=your_password
DB_PORT=5432
DB_SSL=false
```

*(หากต้องการเปลี่ยน API URL ของ Frontend ให้สร้างไฟล์ `todo_list/.env` และระบุ `VITE_API_URL=http://localhost:5000/api/todos`)*

### 4. เริ่มต้นรันระบบ

```bash
# รัน Backend (Port 5000)
cd server
node index.js

# รัน Frontend (Port 5173)
cd ../todo_list
npm run dev
```

---

## API Endpoints หลัก

Base URL: `http://localhost:5000/api/todos`

| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| `GET` | `/` | ตรวจสอบสถานะการทำงานของ API |
| `GET` | `/api/todos` | ดึงรายการงานทั้งหมด |
| `POST` | `/api/todos` | สร้างรายการงานใหม่ |
| `PUT` | `/api/todos/:id` | แก้ไขข้อมูลงาน หรือเปลี่ยนสถานะเสร็จสิ้น |
| `DELETE` | `/api/todos/:id` | ลบรายการงานตาม ID |

---

## คำสั่งที่ใช้บ่อย

```bash
# Frontend
cd todo_list
npm run dev        # รัน Development Server
npm run build      # ตรวจ Type และ Build สำหรับ Production
npx tsc --noEmit   # ตรวจสอบ TypeScript Type

# Backend
cd server
node index.js      # รัน Express Server
npx nodemon index.js # รันแบบ Auto-reload
```