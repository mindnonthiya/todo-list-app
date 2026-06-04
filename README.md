# Todo Planner

Todo Planner คือเว็บแอปสำหรับจัดการงานประจำวันและวางแผนงานแบบ Responsive รองรับทั้ง Desktop, Tablet และ Mobile โดยใช้ React + TypeScript + Vite สำหรับ Frontend และ Express + PostgreSQL สำหรับ Backend API

เอกสารนี้อธิบายโครงสร้างโปรเจกต์ วิธีติดตั้ง วิธีรัน ระบบฐานข้อมูล API และฟีเจอร์หลักของแอปอย่างละเอียดเป็นภาษาไทย

---

## สารบัญ

- [ภาพรวมโปรเจกต์](#ภาพรวมโปรเจกต์)
- [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
- [โครงสร้างโฟลเดอร์](#โครงสร้างโฟลเดอร์)
- [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
- [การติดตั้งและรันโปรเจกต์](#การติดตั้งและรันโปรเจกต์)
- [Environment Variables](#environment-variables)
- [ฐานข้อมูล PostgreSQL](#ฐานข้อมูล-postgresql)
- [โครงสร้างตาราง `public.todos`](#โครงสร้างตาราง-publictodos)
- [API Endpoints](#api-endpoints)
- [ข้อมูล Todo Model](#ข้อมูล-todo-model)
- [Frontend UI และ Responsive Layout](#frontend-ui-และ-responsive-layout)
- [Theme และภาษา](#theme-และภาษา)
- [คำสั่งที่ใช้บ่อย](#คำสั่งที่ใช้บ่อย)
- [แนวทางการพัฒนาต่อ](#แนวทางการพัฒนาต่อ)
- [การแก้ปัญหาเบื้องต้น](#การแก้ปัญหาเบื้องต้น)

---

## ภาพรวมโปรเจกต์

Todo Planner เป็น Productivity Web App สำหรับสร้าง อ่าน แก้ไข ลบ และทำเครื่องหมายงานว่าเสร็จแล้ว โดยมีฟีเจอร์เสริมสำหรับการวางแผน เช่น ปฏิทิน สีของงาน หมวดหมู่ ความสำคัญ วันที่ครบกำหนด เวลาแจ้งเตือน หน้า Analytics และ Profile

เป้าหมายของแอปคือให้ใช้งานง่าย คล้ายแอปจัดการงานสมัยใหม่ เช่น Todoist, TickTick, Notion Mobile หรือ Google Tasks แต่ยังคงโครงสร้าง CRUD ที่ชัดเจนและเข้าใจง่าย

---

## เทคโนโลยีที่ใช้

### Frontend

- React 19
- TypeScript
- Vite
- CSS ปกติในไฟล์ `TodoList.css`
- Lucide React สำหรับไอคอน
- Context API สำหรับ Theme และ Language

### Backend

- Node.js
- Express
- PostgreSQL ผ่านแพ็กเกจ `pg`
- CORS
- dotenv

### Database

- PostgreSQL
- ตารางหลัก: `public.todos`

---

## โครงสร้างโฟลเดอร์

```text
workspace/todo-list-app/
├── database/
│   └── todo.sql                 # SQL สำหรับสร้างฐานข้อมูล/ตาราง todos
├── server/
│   ├── index.js                 # Express API Backend
│   ├── package.json             # Dependencies ของ backend
│   └── .env                     # Environment variables (สร้างเอง)
└── todo_list/
    ├── index.html
    ├── package.json             # Dependencies และ scripts ของ frontend
    ├── src/
    │   ├── App.tsx              # ครอบ ThemeProvider และ LanguageProvider
    │   ├── main.tsx             # React entry point
    │   ├── components/
    │   │   ├── TodoList.tsx     # UI และ logic หลักของ Todo Planner
    │   │   └── TodoList.css     # Styling หลักของแอป
    │   ├── contexts/
    │   │   ├── LanguageContext.tsx
    │   │   ├── ThemeContext.tsx
    │   │   ├── language-core.ts
    │   │   └── theme-core.ts
    │   ├── hooks/
    │   │   ├── useLanguage.ts
    │   │   └── useTheme.ts
    │   └── locales/
    │       ├── en.json          # ข้อความภาษาอังกฤษ
    │       └── th.json          # ข้อความภาษาไทย
    └── public/
```

---

## ฟีเจอร์หลัก

### งาน / Tasks

- เพิ่มงานใหม่
- แสดงรายการงานทั้งหมด
- ค้นหางานตามชื่อ
- กรองงานตามสถานะ
  - ทั้งหมด
  - ยังไม่เสร็จ
  - เสร็จแล้ว
- เรียงลำดับงาน
  - ใหม่สุด
  - เก่าสุด
  - เสร็จแล้ว
  - ความสำคัญ
- แก้ไขชื่องาน
- ลบงานพร้อมกล่องยืนยัน
- Mark Complete / Incomplete

### Metadata ของงาน

แต่ละงานรองรับข้อมูลเพิ่มเติมดังนี้

- `note` รายละเอียด/บันทึกของงาน
- `color` สีของงาน
- `priority` ความสำคัญ
- `category` หมวดหมู่
- `dueDate` วันที่ครบกำหนด
- `dueTime` เวลาครบกำหนด
- `alarmEnabled` เปิด/ปิดการแจ้งเตือน
- `alarmDateTime` วันและเวลาสำหรับแจ้งเตือน

### Calendar

- แสดงปฏิทินรายเดือน
- ปุ่มเดือนก่อนหน้า / เดือนถัดไป
- Highlight วันที่ปัจจุบัน
- Highlight วันที่เลือก
- แสดง indicator เมื่อวันนั้นมีงาน
- แสดงรายการงานของวันที่เลือก

### Analytics

- Completion Rate
- Completed vs Pending
- Weekly Chart
- Tasks This Week
- Tasks This Month
- Current Streak

### Profile

- แสดงชื่อผู้ใช้และ Level
- สถิติรวม เช่น Total Tasks, Completed Tasks, Completion Rate, Current Streak, Longest Streak
- Achievement Badges
- Theme Toggle
- Language Toggle

---

## การติดตั้งและรันโปรเจกต์

> หมายเหตุ: โปรเจกต์แยก Frontend และ Backend เป็นคนละโฟลเดอร์ ต้องติดตั้ง dependencies แยกกัน

### 1. ติดตั้ง Backend

```bash
cd server
npm install
```

### 2. ติดตั้ง Frontend

```bash
cd ../todo_list
npm install
```

### 3. เตรียมฐานข้อมูล PostgreSQL

สร้างฐานข้อมูล เช่น `todo_app` แล้วรัน SQL ในไฟล์:

```bash
database/todo.sql
```

หรือคัดลอก SQL ในหัวข้อ [โครงสร้างตาราง `public.todos`](#โครงสร้างตาราง-publictodos) ไปรันใน PostgreSQL / Supabase SQL Editor ได้โดยตรง

### 4. สร้างไฟล์ `.env` สำหรับ Backend

สร้างไฟล์ `server/.env`

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=todo_app
DB_PASSWORD=your_password
DB_PORT=5432
DB_SSL=false
```

ถ้าใช้ Supabase หรือ PostgreSQL ที่ต้องใช้ SSL ให้ตั้งค่า:

```env
DB_SSL=true
```

### 5. รัน Backend

ในโฟลเดอร์ `server`

```bash
node index.js
```

Backend จะรันที่:

```text
http://localhost:5000
```

### 6. รัน Frontend

ในโฟลเดอร์ `todo_list`

```bash
npm run dev
```

Frontend จะรันที่ Vite dev server เช่น:

```text
http://localhost:5173
```

---

## Environment Variables

### Backend (`server/.env`)

| ตัวแปร         | ตัวอย่าง             | คำอธิบาย                                |
| ------------- | ------------------ | ------------------------------------- |
| `PORT`        | `5000`             | Port สำหรับ Express server              |
| `DB_USER`     | `postgres`         | Username ของ PostgreSQL               |
| `DB_HOST`     | `localhost`        | Host ของฐานข้อมูล                       |
| `DB_NAME`     | `todo_app`         | ชื่อฐานข้อมูล                             |
| `DB_PASSWORD` | `password`         | Password ของ PostgreSQL               |
| `DB_PORT`     | `5432`             | Port ของ PostgreSQL                   |
| `DB_SSL`      | `false` หรือ `true` | เปิด SSL เมื่อใช้ฐานข้อมูลบน Cloud/Supabase |

### Frontend

Frontend ใช้ค่า API เริ่มต้นเป็น:

```text
http://localhost:5000/api/todos
```

ถ้าต้องการเปลี่ยน URL API ให้สร้างไฟล์ `.env` ในโฟลเดอร์ `todo_list`

```env
VITE_API_URL=http://localhost:5000/api/todos
```

---

## ฐานข้อมูล PostgreSQL

Backend ใช้ PostgreSQL table ชื่อ `public.todos` เป็นตารางหลักในการเก็บข้อมูล Todo ทั้งหมด

เมื่อ Server เริ่มทำงาน ฟังก์ชัน `ensureTodoColumns()` ใน `server/index.js` จะพยายามเพิ่มคอลัมน์ที่จำเป็นด้วยคำสั่ง `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` เพื่อช่วยให้ฐานข้อมูลเก่าที่มีเฉพาะ field พื้นฐานสามารถใช้งานกับแอปเวอร์ชันใหม่ได้

---

## โครงสร้างตาราง `public.todos`

โครงสร้างฐานข้อมูลปัจจุบันที่ใช้งานกับแอป:

```sql
create table public.todos (
  id bigserial not null,
  title text not null,
  completed boolean null default false,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp without time zone null default CURRENT_TIMESTAMP,
  note text not null default ''::text,
  color character varying(20) not null default 'green'::character varying,
  priority character varying(20) not null default 'medium'::character varying,
  category character varying(30) not null default 'other'::character varying,
  due_date date null,
  alarm_enabled boolean not null default false,
  alarm_datetime timestamp without time zone null,
  description text not null default ''::text,
  due_time time without time zone null,
  constraint todos_pkey primary key (id)
) TABLESPACE pg_default;
```

### คำอธิบายคอลัมน์

| คอลัมน์            | ประเภท        | ค่าเริ่มต้น             | คำอธิบาย                                                   |
| ---------------- | ------------- | ------------------- | -------------------------------------------------------- |
| `id`             | `bigserial`   | Auto increment      | Primary key ของแต่ละ todo                                 |
| `title`          | `text`        | -                   | ชื่องาน ต้องมีค่าเสมอ                                         |
| `completed`      | `boolean`     | `false`             | สถานะว่างานเสร็จแล้วหรือไม่                                   |
| `created_at`     | `timestamp`   | `CURRENT_TIMESTAMP` | วันที่/เวลาที่สร้างรายการ                                      |
| `updated_at`     | `timestamp`   | `CURRENT_TIMESTAMP` | วันที่/เวลาที่แก้ไขล่าสุด                                        |
| `note`           | `text`        | `''`                | รายละเอียดหรือบันทึกของงาน                                   |
| `color`          | `varchar(20)` | `green`             | สีของงาน เช่น green, blue, yellow, orange, purple, red     |
| `priority`       | `varchar(20)` | `medium`            | ความสำคัญ เช่น low, medium, high                            |
| `category`       | `varchar(30)` | `other`             | หมวดหมู่ เช่น work, study, personal, health, other          |
| `due_date`       | `date`        | `null`              | วันที่ครบกำหนดของงาน                                         |
| `due_time`       | `time`        | `null`              | เวลาครบกำหนดของงาน                                        |
| `alarm_enabled`  | `boolean`     | `false`             | เปิด/ปิดการแจ้งเตือน                                         |
| `alarm_datetime` | `timestamp`   | `null`              | วันและเวลาที่ใช้สำหรับ reminder                                |
| `description`    | `text`        | `''`                | field สำรอง/รองรับข้อมูลจาก client เก่า ปัจจุบัน UI หลักใช้ `note` |

---

## API Endpoints

Base URL เริ่มต้น:

```text
http://localhost:5000
```

### `GET /`

ตรวจสอบว่า API ทำงานอยู่หรือไม่

#### Response

```json
{
  "message": "Todo API is running"
}
```

### `GET /api/todos`

ดึงรายการ todos ทั้งหมด เรียงจากรายการล่าสุดไปเก่าสุด

#### Response ตัวอย่าง

```json
[
  {
    "id": 1,
    "title": "Prepare weekly roadmap",
    "note": "Draft priorities and timeline",
    "description": "Draft priorities and timeline",
    "completed": false,
    "color": "green",
    "priority": "medium",
    "category": "work",
    "dueDate": "2026-06-04T00:00:00.000Z",
    "dueTime": "09:00:00",
    "alarmEnabled": true,
    "alarm": true,
    "alarmDateTime": "2026-06-04T09:00:00.000Z",
    "created_at": "2026-06-04T08:00:00.000Z",
    "updated_at": "2026-06-04T08:00:00.000Z"
  }
]
```

### `POST /api/todos`

สร้าง todo ใหม่

#### Request Body

```json
{
  "title": "Prepare weekly roadmap",
  "note": "Draft priorities and timeline",
  "color": "green",
  "priority": "medium",
  "category": "work",
  "dueDate": "2026-06-04",
  "dueTime": "09:00",
  "alarmEnabled": true,
  "alarmDateTime": "2026-06-04T09:00"
}
```

#### Field ที่จำเป็น

- `title` ต้องมีค่าและห้ามเป็น string ว่าง

#### Field ที่มี fallback

| Field                  | ค่า fallback    |
| ---------------------- | -------------- |
| `note` / `description` | `''`           |
| `color`                | `green`        |
| `priority`             | `medium`       |
| `category`             | `other`        |
| `dueDate`              | `CURRENT_DATE` |
| `alarmEnabled`         | `false`        |
| `alarmDateTime`        | `null`         |

### `PUT /api/todos/:id`

อัปเดต todo ตาม `id`

ใช้สำหรับ:

- แก้ไขชื่อ
- แก้ไข note
- เปลี่ยนสถานะ completed
- เปลี่ยนสี
- เปลี่ยน priority/category
- เปลี่ยน due date/time
- เปลี่ยน alarm

#### Request Body ตัวอย่าง: เปลี่ยนสถานะงาน

```json
{
  "completed": true
}
```

#### Request Body ตัวอย่าง: แก้ไขข้อมูลหลาย field

```json
{
  "title": "Update product backlog",
  "note": "Review tasks with team",
  "color": "blue",
  "priority": "high",
  "category": "work",
  "dueDate": "2026-06-05",
  "dueTime": "14:30",
  "alarmEnabled": true,
  "alarmDateTime": "2026-06-05T14:00"
}
```

### `DELETE /api/todos/:id`

ลบ todo ตาม `id`

#### Response

```json
{
  "message": "Todo deleted"
}
```

---

## ข้อมูล Todo Model

Frontend ใช้ข้อมูลหลักตามรูปแบบนี้:

```ts
interface Todo {
  id: number;
  title: string;
  note?: string;
  completed: boolean;
  color?: "green" | "blue" | "yellow" | "orange" | "purple" | "red";
  priority?: "low" | "medium" | "high";
  category?: "work" | "study" | "personal" | "health" | "other";
  dueDate?: string;
  dueTime?: string;
  alarm?: boolean;
  alarmEnabled?: boolean;
  alarmDateTime?: string | null;
  created_at?: string;
  updated_at?: string;
}
```

### ค่าสีที่รองรับ

- `green`
- `blue`
- `yellow`
- `orange`
- `purple`
- `red`

### ค่าความสำคัญที่รองรับ

- `low`
- `medium`
- `high`

### หมวดหมู่ที่รองรับ

- `work`
- `study`
- `personal`
- `health`
- `other`

---

## Frontend UI และ Responsive Layout

### Desktop

- ใช้ layout แบบ Dashboard
- มี Sidebar navigation ด้านซ้าย
- พื้นที่เนื้อหาหลักอยู่ด้านขวา
- Calendar และ task panel แสดงแบบ grid

### Tablet

- Sidebar ย่อขนาด
- Cards และ task board ปรับเป็น layout ที่อ่านง่ายขึ้น
- Calendar ลดขนาดตามพื้นที่

### Mobile

- ใช้ Bottom Navigation
- เนื้อหาเป็น single column
- Cards เรียงแนวตั้ง
- Calendar day cells มีขนาดเล็กลงเพื่อให้พอดีกับหน้าจอ
- Profile, Forms และ Task Cards ถูกปรับ spacing ให้เหมาะกับหน้าจอ 375px–430px

---

## Theme และภาษา

### Theme

แอปรองรับ:

- Light Theme
- Dark Theme

สถานะ theme ถูกเก็บใน `localStorage` ด้วย key:

```text
todo-planner-theme
```

### Language

แอปรองรับ:

- English (`en`)
- Thai (`th`)

สถานะภาษาถูกเก็บใน `localStorage` ด้วย key:

```text
todo-planner-language
```

ไฟล์ข้อความอยู่ที่:

```text
src/locales/en.json
src/locales/th.json
```

---

## คำสั่งที่ใช้บ่อย

### Frontend

รัน dev server:

```bash
cd todo_list
npm run dev
```

Build production:

```bash
cd todo_list
npm run build
```

Lint:

```bash
cd todo_list
npm run lint
```

Preview production build:

```bash
cd todo_list
npm run preview
```

### Backend

รัน API server:

```bash
cd server
node index.js
```

ตรวจ syntax ของ server:

```bash
node --check server/index.js
```

---

## แนวทางการพัฒนาต่อ

ข้อเสนอแนะสำหรับการพัฒนาต่อในอนาคต:

1. เพิ่มระบบ Authentication จริง
2. ผูก Profile กับข้อมูลผู้ใช้จริง
3. เพิ่ม Browser Notifications จาก `alarm_datetime`
4. เพิ่ม recurring tasks
5. เพิ่ม drag-and-drop สำหรับจัดลำดับ task
6. เพิ่ม unit tests และ integration tests
7. เพิ่ม API validation ที่เข้มขึ้นด้วย schema validation เช่น Zod หรือ Joi
8. เพิ่ม migration system อย่างเป็นทางการ เช่น Prisma, Knex หรือ node-pg-migrate

---

## การแก้ปัญหาเบื้องต้น

### Frontend เรียก API ไม่ได้

ตรวจสอบว่า Backend รันอยู่ที่ port 5000 หรือไม่:

```bash
curl http://localhost:5000/
```

ถ้า Frontend ใช้ API URL อื่น ให้ตรวจ `.env` ใน `todo_list`

```env
VITE_API_URL=http://localhost:5000/api/todos
```

### Backend ต่อ PostgreSQL ไม่ได้

ตรวจสอบค่าใน `server/.env`:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=todo_app
DB_PASSWORD=your_password
DB_PORT=5432
DB_SSL=false
```

ถ้าใช้ Supabase หรือ Cloud PostgreSQL ให้ลองตั้งค่า:

```env
DB_SSL=true
```

### ตารางไม่มีคอลัมน์ใหม่

โดยปกติ server จะรัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ให้อัตโนมัติเมื่อเริ่มทำงาน แต่หากยังมีปัญหา ให้รัน SQL ในไฟล์ `database/todo.sql` อีกครั้ง

### Port ถูกใช้งานอยู่

เปลี่ยน `PORT` ใน `server/.env`

```env
PORT=5001
```

แล้วอัปเดต `VITE_API_URL` ให้ตรงกัน

---

## หมายเหตุสำคัญ

- UI หลักใช้ field `note` สำหรับรายละเอียดงาน
- Database ยังมี `description` เพื่อรองรับข้อมูลเก่าหรือ client ที่ส่ง field นี้มา
- Backend จะพยายาม map `description` และ `note` ให้สอดคล้องกันในจุดที่จำเป็น
- หากใช้งานบน production ควรตั้งค่า CORS, SSL, logging และ migration strategy ให้เหมาะสมกว่าโหมด development