# Trang English

Website học tiếng Anh **tĩnh** (HTML/CSS/JS + Vite). Không cần database hay backend.

Giáo viên / người quản trị cập nhật bài học chủ yếu qua **Lesson Editor** — nội dung được ghi thẳng vào `data/lessons.json`.

---

## Bắt đầu nhanh

### 1. Cài đặt & chạy

**Cách đơn giản (Windows):** double-click file `Run-website-TrangEnglish.bat` — tự cài lần đầu (nếu cần), mở trình duyệt, và chạy website. File này dùng thư mục chứa chính nó làm gốc project, nên copy sang máy khác vẫn chạy được (sau khi đã cài Node.js).

Hoặc dùng terminal:

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra (thường là **http://localhost:5173**).

| Trang | Địa chỉ |
|-------|---------|
| Trang chủ | `/` |
| Danh sách bài | `/lessons.html` |
| Chi tiết bài | `/lesson.html?id=...` |
| Giới thiệu | `/about.html` |
| Liên hệ | `/contact.html` |
| **Soạn bài (Editor)** | `/editor.html` |

> **Lưu ý:** Muốn Editor ghi được file, phải chạy bằng `npm run dev` (hoặc `npm run preview`). Không mở file `.html` trực tiếp bằng Explorer.

### 2. Đưa lên hosting (GitHub Pages — miễn phí)

Repo đã có sẵn: `https://github.com/dangdinhvu221/Website-TrangEnglish`

**Lần đầu bật trang web công khai:**

1. Commit + push code lên nhánh `main` (kèm file workflow `.github/workflows/deploy-pages.yml`).
2. Vào GitHub → repo **Website-TrangEnglish** → **Settings** → **Pages**.
3. Mục **Build and deployment** → **Source** chọn **GitHub Actions**.
4. Vào tab **Actions** đợi workflow **Deploy GitHub Pages** chạy xong (màu xanh).
5. Mở link:

`https://dangdinhvu221.github.io/Website-TrangEnglish/`

Mỗi lần `git push` lên `main`, site tự build lại. Máy khác chỉ cần mở link — **không cần cài Node.js**.

> **Lưu ý:** Trên GitHub Pages, Editor **không lưu được** bài lên server (chỉ xem / học). Muốn soạn bài và lưu: chạy local bằng `Run-website-TrangEnglish.bat`, rồi push lại để cập nhật bản online.

**Hosting khác (Netlify, v.v.):**

```bash
npm run build
```

Upload thư mục `dist/` lên Netlify, Cloudflare Pages, v.v.

Xem trước bản build:

```bash
npm run preview
```

---

## Làm việc hàng ngày: Lesson Editor

Đây là cách **khuyên dùng** để thêm / sửa / xoá bài học.

### Các bước

1. Chạy `npm run dev`.
2. Mở **Editor** (menu hoặc `/editor.html`).
3. Tab **Lessons** → chọn **Level** → **Thêm Lesson** (hoặc **Lesson mẫu nhanh**).
4. Điền Title, Summary, thêm bài tập bằng các nút `+ Flashcards`, `+ Picture chase`, …
5. Bấm **Lưu Lesson** → dữ liệu được **ghi thẳng vào `data/lessons.json`**.
6. Mở / refresh trang **Lessons** để xem trên web.

### Các nút thường dùng

| Nút | Việc làm |
|-----|----------|
| **Thêm Lesson** | Tạo bài trống, mở form thiết kế |
| **Lesson mẫu nhanh** | Tạo bài có sẵn vài dạng tập để sửa tiếp |
| **Sửa / Nhân bản / Xoá** | Chỉnh, copy, hoặc xoá bài (xoá ghi luôn vào file) |
| **Lưu Lesson / Lưu Level** | Ghi vào `data/lessons.json` |
| **Huỷ / Quay lại** | Bỏ bản đang tạo (chưa Lưu thì chưa ghi file) |
| **Tải bản sao JSON** | Backup thêm (không bắt buộc) |
| **Nạp file JSON** | Ghi đè toàn bộ vào `data/lessons.json` |
| **Tải lại từ file** | Đọc lại nội dung hiện có trên đĩa |

### Viết nội dung bài tập (mỗi dòng một mục)

| Loại | Cách viết mỗi dòng |
|------|---------------------|
| **Flashcards** | `mặt trước \| mặt sau` |
| **Picture chase** | `ảnh \| đáp án \| lựa chọn1, lựa chọn2` — hoặc bấm **Chọn ảnh…** |
| **Build a sentence** | `các từ cách nhau bởi dấu cách \| câu đúng` |
| **Match** | `trái \| phải` |
| **Write** | `câu hỏi \| gợi ý \| đáp án \| đáp án phụ (tuỳ chọn)` |

Ví dụ Picture chase:

```text
🍎 | apple | apple, ball, cat
/images/cat.jpg | cat | cat, dog, bird | A cat
```

---

## Sửa nội dung khác (không phải bài học)

| Muốn đổi | File |
|----------|------|
| Tên site, menu, CTA, footer, email/SĐT | `data/site.js` |
| Chữ trang Home / About / Contact / Lessons | `data/pages.js` |
| Tên các dạng bài trên UI | `data/exercise-types.js` |
| **Bài học + cấp học + bài tập** | `data/lessons.json` (ưu tiên Editor) |

Sau khi lưu file data, trang đang chạy `npm run dev` thường tự cập nhật.  
Đã build production → chạy lại `npm run build`.

---

## Cấu trúc bài học (tóm tắt)

Trong `data/lessons.json`:

1. **`levels`** — cấp học (vd: Level 1, Level 2)
2. **`lessons`** — từng chủ đề; mỗi lesson có nhiều **`exercises`**

Một lesson gồm: `id`, `levelId`, `title`, `summary`, `body`, `tip`, `exercises`.

- `id` dùng trên URL: `/lesson.html?id=animals`
- `levelId` phải trùng `id` của một level (vd: `cap-1`)

### Năm dạng bài tập

| `type` | Tên | Ý tưởng |
|--------|-----|---------|
| `flip` | Flashcards | Lật thẻ |
| `picture` | Picture chase | Nhìn ảnh, chọn từ |
| `sentence` | Build a sentence | Ghép chữ thành câu |
| `match` | Match | Nối cặp |
| `write` | Write | Gõ đáp án |

Chi tiết field từng loại (khi sửa tay JSON): xem phần **Phụ lục** bên dưới.

---

## Thêm ảnh (Picture chase)

Field `image` nhận một trong các dạng:

1. **Emoji** — `"🍎"`
2. **File local** — copy vào `public/images/`, rồi dùng `"/images/ten-file.png"`
3. **URL online** — `"https://..."`
4. **Chọn ảnh trong Editor** — hệ thống nhúng ảnh (data URL) vào bài

⚠️ Không dùng đường dẫn Windows kiểu `C:\Users\...`.

---

## Checklist khi thêm bài

- [ ] Đang chạy `npm run dev` khi dùng Editor
- [ ] Đã bấm **Lưu** và thấy thông báo ghi `data/lessons.json`
- [ ] `id` lesson viết thường, có dấu `-` nếu cần (`my-family`), không trùng
- [ ] `levelId` đúng level đã có
- [ ] Ảnh local nằm trong `public/images/`
- [ ] (Tuỳ chọn) Hiện trên Home: thêm `id` vào `pages.home.featured.lessonIds` trong `data/pages.js`

---

## Cấu trúc thư mục

```text
*.html                  ← Các trang (giữ ở root để URL ổn định)
data/                   ← Nội dung site (bài học, chữ, menu)
  lessons.json          ← Bài học (Editor ghi vào đây)
  site.js / pages.js    ← Thông tin site & chữ các trang
  exercise-types.js     ← Nhãn dạng bài
public/                 ← File tĩnh (favicon, ảnh)
  images/               ← Ảnh bài tập → URL /images/...
src/
  pages/                ← JS từng trang
  components/           ← Header, footer, danh sách bài
  exercises/            ← Logic bài tập tương tác
  styles/               ← CSS
  utils.js
scripts/
  lessons-api.js        ← API ghi lessons.json khi dev
  pack.ps1              ← Đóng gói copy sang máy khác
Run-website-TrangEnglish.bat  ← Mở website bằng double-click
vite.config.js
```

---

## Câu hỏi thường gặp

**Sửa bài xong có mất không?**  
Không — nếu đã **Lưu** khi đang `npm run dev`, dữ liệu nằm trong `data/lessons.json` trên máy bạn.

**Mở Editor bằng file HTML trực tiếp được không?**  
Không ghi được đĩa. Luôn dùng `npm run dev` → mở `http://localhost:5173/editor.html`.

**Làm sao xem bài mới trên trang học?**  
Refresh `/lessons.html` hoặc `/lesson.html?id=...`.

**Muốn backup?**  
Dùng **Tải bản sao JSON**, hoặc commit `data/lessons.json` bằng Git.

---

## Công nghệ

Vite + HTML/CSS/JavaScript thuần. Không React, không database, không CMS.

---

## Phụ lục — Sửa tay `lessons.json` (tuỳ chọn)

Chỉ cần khi không dùng Editor.

### Flashcards (`flip`)

```json
{
  "id": "animals-flip",
  "type": "flip",
  "title": "Flashcards",
  "prompt": "Flip to see the word.",
  "cards": [
    { "front": "🐱", "back": "cat" }
  ]
}
```

### Picture chase (`picture`)

```json
{
  "id": "animals-picture",
  "type": "picture",
  "title": "Picture chase",
  "prompt": "What animal is this?",
  "items": [
    {
      "image": "/images/cat.jpg",
      "imageAlt": "A cat",
      "options": ["cat", "dog", "bird"],
      "answer": "cat"
    }
  ]
}
```

### Build a sentence (`sentence`)

```json
{
  "id": "colours-sentence",
  "type": "sentence",
  "title": "Build a sentence",
  "prompt": "Make a full sentence.",
  "items": [
    { "words": ["is", "It", "blue"], "answer": "It is blue" }
  ]
}
```

### Match (`match`)

```json
{
  "id": "colours-match",
  "type": "match",
  "title": "Match",
  "prompt": "Match the pairs.",
  "pairs": [
    { "left": "red", "right": "like a strawberry" }
  ]
}
```

### Write (`write`)

```json
{
  "id": "numbers-write",
  "type": "write",
  "title": "Write",
  "prompt": "Type the word.",
  "items": [
    {
      "prompt": "Write the English word for 3",
      "hint": "Starts with th…",
      "answer": "three",
      "accept": ["three"]
    }
  ]
}
```

`accept` (tuỳ chọn): các đáp án khác vẫn được tính đúng (không phân biệt hoa thường).
