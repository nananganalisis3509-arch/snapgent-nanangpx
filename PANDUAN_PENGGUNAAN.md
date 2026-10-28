# Dokumentasi & Panduan Penggunaan Snapgent (`snapgentV3`)

Dokumen ini berisi panduan lengkap instalasi, arsitektur, daftar **15 AI Agent** yang didukung, referensi seluruh **24 MCP Tools VS Code**, serta panduan pemecahan masalah (**Troubleshooting**).

---

## 1. Gambaran Umum & Arsitektur

**Snapgent (`snapgentV3`)** mengubah layanan chat AI berbasis web menjadi *coding agent* otonom yang dapat membaca, mengedit, membuat file, mengecek Git, serta menjalankan perintah dan pengujian langsung di **Visual Studio Code** atau **Roblox Studio** tanpa memerlukan API Key berbayar.

```
[ Situs Web AI (ChatGPT / Claude / Gemini / dll.) ]
                     │
        (Content Script + Parser JSON/LUA)
                     ▼
[ Ekstensi Browser Snapgent (background.js) ]
                     │
        (WebSocket: ws://127.0.0.1:17613)
                     ▼
      [ Local Bridge (bridge.exe / start.bat) ]
            ├──► vscode_mcp.py  ──► Workspace Visual Studio Code (24 Tools)
            └──► StudioMCP.exe  ──► Roblox Studio (Luau & Game Tree Tools)
```

---

## 2. Instalasi Ekstensi Browser

1. Buka browser berbasis Chromium (**Google Chrome**, **Microsoft Edge**, atau **Brave**).
2. Buka halaman manajemen ekstensi:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Aktifkan **Developer mode** (*Mode pengembang*) di pojok kanan atas.
4. Klik tombol **Load unpacked** (*Muat yang belum dikemas*).
5. Pilih folder **`snapgent-extension`** di dalam direktori project ini (`c:\laragon\www\snapgent\snapgent-extension`).
6. *(Penting setiap kali ada pembaruan kode)* Klik ikon **Reload (⟳)** pada kartu ekstensi **snapgentV3 × Roblox Studio Agent**, lalu tekan **F5** pada tab AI yang sedang dibuka.

---

## 3. Menjalankan Local Bridge

Local Bridge bertugas menghubungkan ekstensi browser dengan **VS Code** dan **Roblox Studio** di komputer Anda:

1. Jalankan file **`start.bat`** (klik 2x dari Windows Explorer atau jalankan `.\start.bat` di terminal pada folder `c:\laragon\www\snapgent`).
2. `start.bat` akan otomatis menjalankan **`setup-config.ps1`** yang melakukan:
   - Deteksi instalasi Python & [`vscode_mcp.py`](file:///c:/laragon/www/snapgent/vscode_mcp.py) untuk server MCP **VS Code**.
   - Deteksi `StudioMCP.exe` (jika Roblox Studio terinstal) untuk server MCP **Roblox Studio**.
   - Pembaruan file [`config.json`](file:///c:/laragon/www/snapgent/config.json) secara otomatis.
   - *(Opsional)* Jika aplikasi **Claude Desktop** terinstal di komputer Anda (`%APPDATA%\Claude\claude_desktop_config.json`), skrip otomatis mendaftarkan server MCP `snapgent-vscode` ke Claude Desktop.
3. Jendela terminal **Snapgent Bridge** akan terbuka dan mendengarkan koneksi pada port `17613`. **Biarkan jendela ini tetap terbuka** (boleh di-*minimize*) selama Anda menggunakan Snapgent.

---

## 4. Daftar Lengkap 15 AI Agent yang Didukung

Anda dapat menggunakan Snapgent di **15 platform AI web** berikut:

| No | AI Agent | Alamat URL | File Provider | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **ChatGPT (OpenAI)** | `https://chatgpt.com/` | `providers/chatgpt.js` & `chatgpt-cm.js` | Mendukung CodeMirror tap untuk blok kode panjang & injeksi ProseMirror. |
| 2 | **Claude (Anthropic)** | `https://claude.ai/new` | `providers/claude.js` | Sangat akurat untuk pemrograman, refactoring, dan pemanggilan tool JSON. |
| 3 | **DeepSeek** | `https://chat.deepseek.com/` | `providers/deepseek.js` | Gratis, cepat, mendukung mode *DeepThink* (R1/V3). |
| 4 | **Google Gemini** | `https://gemini.google.com/app` | `providers/gemini.js` | Mendukung input gambar (*vision*) dari tangkapan layar. |
| 5 | **Qwen (Alibaba)** | `https://chat.qwen.ai/` | `providers/qwen.js` & `qwen-net.js` | Kuat untuk coding (Qwen3 / Qwen2.5-Coder) & mendukung *vision*. |
| 6 | **Grok (xAI)** | `https://grok.com/` | `providers/grok.js` | Respons cepat dengan konteks panjang. |
| 7 | **Kimi (Moonshot AI)** | `https://www.kimi.ai/` | `providers/kimi.js` | Mendukung konteks dokumen besar & *vision*. |
| 8 | **GLM / Z.ai (Zhipu)** | `https://chat.z.ai/` | `providers/glm.js` | Model GLM-4.5/GLM-4 yang stabil untuk eksekusi tool. |
| 9 | **LMSYS Chatbot Arena** | `https://arena.ai/text/direct` | `providers/arena.js` | Gunakan mode **Direct Chat** untuk mengakses berbagai model secara gratis. |
| 10 | **Meta AI (Llama)** | `https://www.meta.ai/` | `providers/meta.js` | Berbasis model Llama dari Meta. |
| 11 | **Ptero** | `https://ptero.pro/` | `providers/ptero.js` | Alternatif chat AI cepat dan ringan. |
| 12 | **Perplexity** | `https://www.perplexity.ai/` | `providers/extra-chat.js` | Situs pencarian AI; login mungkin diperlukan. |
| 13 | **Mistral Vibe** | `https://chat.mistral.ai/chat` | `providers/extra-chat.js` | Nama baru untuk Le Chat; fokus assistant dan coding. |
| 14 | **Microsoft Copilot** | `https://copilot.com/` | `providers/extra-chat.js` | Mendukung domain Copilot personal dan beberapa domain Microsoft. |
| 15 | **Poe** | `https://poe.com/` | `providers/extra-chat.js` | Pilih bot/model Poe sebelum memulai sesi Snapgent. |

---

## 5. Panduan Penggunaan dengan Claude & ChatGPT

### A. Menggunakan Claude Web (`https://claude.ai/new`)
1. Klik ikon ekstensi **snapgentV3** di pojok kanan atas browser Chrome, lalu klik tombol **`Open Claude`** (atau buka `https://claude.ai/new`).
2. Pastikan aplikasi **VS Code** sudah membuka folder project yang ingin dikerjakan (**File → Open Folder...**).
3. Di bagian atas kotak chat Claude, pastikan bar Snapgent menampilkan status **`Ready.`** dan target dropdown memilih **`VS Code`**.
4. Klik tombol **`▶︎ Start`**:
   - Snapgent otomatis mengirimkan prompt sistem (ditampilkan sebagai chip **`Starting Up`**) dan memuat daftar 24 tools.
   - Setelah status berubah menjadi **`Active · 24 tools · VS Code`**, ketik perintah coding Anda di kotak chat Claude.

### B. Menggunakan ChatGPT (`https://chatgpt.com/`)
1. Klik ikon ekstensi **snapgentV3** di toolbar browser lalu klik **`Open ChatGPT`** (atau buka `https://chatgpt.com/`).
2. Pastikan Anda berada di halaman **New Chat** (percakapan kosong).
3. Pilih target **`VS Code`** (atau **`Roblox Studio`**) pada bar Snapgent di atas kotak input, lalu klik **`▶︎ Start`**.
4. Tunggu hingga inisialisasi selesai (`Active · 24 tools · VS Code`), lalu tuliskan tugas yang ingin dikerjakan oleh ChatGPT.
5. Untuk sesi percakapan yang panjang di ChatGPT, Snapgent secara otomatis menyisipkan pengingat instruksi (*Reminder chip*) setiap beberapa putaran agar ChatGPT tidak lupa cara memanggil tool.

### C. Menggunakan Aplikasi Claude Desktop *(Opsional)*
Jika Anda menginstal aplikasi **Claude Desktop** di Windows:
1. Jalankan `start.bat` satu kali agar `setup-config.ps1` mendaftarkan `snapgent-vscode` ke `%APPDATA%\Claude\claude_desktop_config.json`.
2. Restart aplikasi Claude Desktop.
3. Seluruh 24 tools VS Code (`snapgent-vscode`) akan langsung muncul di menu ikon palu/tools bawaan Claude Desktop.

---

## 6. Referensi 24 Tools MCP VS Code (`vscode_mcp.py`)

Saat target disetel ke **VS Code**, AI Agent memiliki akses ke **24 tools** berikut di dalam folder project VS Code yang sedang aktif:

### 1. Navigasi & Informasi Project
- `get_workspace_info`: Menampilkan path folder kerja aktif di VS Code.
- `get_project_info`: Menganalisis jenis project, bahasa pemrograman, file konfigurasi (`package.json`, `pyproject.toml`, dll.), dan struktur direktori tingkat atas.
- `list_dir`: Menampilkan daftar file dan subfolder di dalam suatu direktori.
- `list_tree`: Menampilkan struktur pohon direktori (*directory tree*) hingga kedalaman tertentu.
- `find_files`: Mencari file berdasarkan pola nama (*glob pattern*, misal `*.tsx` atau `*controller*`).
- `search_files`: Mencari teks atau *regex* di seluruh isi file dalam project (seperti fitur *Find in Files* VS Code).

### 2. Pembacaan File
- `read_file`: Membaca seluruh isi file teks.
- `read_files`: Membaca beberapa file sekaligus dalam satu panggilan tool.
- `read_file_lines`: Membaca rentang baris tertentu (`start_line` hingga `end_line`) — sangat berguna untuk file berukuran besar.
- `get_file_info`: Menampilkan metadata file (ukuran, jumlah baris, waktu modifikasi).
- `get_file_outline`: Menampilkan daftar simbol/kerangka kode (class, function, method) beserta nomor barisnya.

### 3. Pembuatan & Pengeditan File
- `create_file`: Membuat file baru (secara aman menolak menimpa file yang sudah ada kecuali `overwrite: true`).
- `write_file`: Menulis atau memperbarui seluruh isi file.
- `edit_file`: Mengganti potongan kode spesifik (`old_text` → `new_text`) secara presisi di dalam file.
- `create_directory`: Membuat folder/direktori baru.
- `move_file`: Memindahkan atau mengubah nama (*rename*) file/folder di dalam workspace.
- `copy_file`: Menyalin file ke lokasi baru di dalam workspace.

### 4. Integrasi Git
- `git_status`: Melihat status perubahan file (`modified`, `staged`, `untracked`).
- `git_diff`: Melihat detail perubahan baris kode (*diff*).
- `git_log`: Melihat riwayat commit terbaru.
- `git_branches`: Melihat daftar branch Git dan branch yang sedang aktif.

### 5. Eksekusi Perintah & Pengujian
- `run_command`: Menjalankan perintah shell/terminal di direktori workspace (misal `npm test`, `composer install`, `git status`).
- `run_python`: Menjalankan skrip atau potongan kode Python di direktori workspace.
- `run_tests`: Menjalankan *test suite* project secara otomatis (`pytest`, `unittest`, `npm test`, `cargo test`, `go test`).

---

## 7. Pengujian Otomatis (Unit & Smoke Tests)

Repository ini dilengkapi rangkaian pengujian otomatis untuk memastikan seluruh komponen berjalan dengan baik:

```powershell
# 1. Uji provider ChatGPT (CodeMirror tap, ProseMirror injection, fallback textarea)
node snapgent-extension/test-chatgpt.js

# 2. Uji provider Claude (ProseMirror injection, deduplikasi turn, ekstraksi kode)
node snapgent-extension/test-claude.js

# 3. Uji parser perintah JSON/LUA & konfigurasi prompt sistem
node snapgent-extension/test-parser.js

# 4. Uji provider Meta AI
node snapgent-extension/test-meta.js

# 5. Uji server MCP VS Code (24 tools, keamanan path workspace, operasi file)
python -m unittest -v test_vscode_mcp.py
```

---

## 8. Pemecahan Masalah (Troubleshooting)

| Gejala / Status di Bar | Penyebab | Solusi |
| :--- | :--- | :--- |
| **`Run start.bat`** / **`Bridge offline`** | Proses `bridge.exe` belum berjalan atau tertutup | Jalankan `start.bat` di folder project dan biarkan jendelanya tetap terbuka. |
| **`Open a folder in VS Code`** | VS Code belum dibuka atau belum ada folder project yang aktif | Buka aplikasi VS Code, lalu pilih **File → Open Folder...** pada project Anda. |
| **`No agent. Open a new chat.`** | Anda membuka riwayat percakapan lama yang sudah berisi pesan | Klik **New Chat** di situs AI untuk membuat ruang chat kosong, lalu klik **`▶︎ Start`**. |
| **`Paused · open this tab`** | Tab browser AI berada di latar belakang (*background*) saat agent bekerja | Klik kembali tab AI tersebut agar tampil di layar utama (*foreground*). |
| **`Disconnected · reload page`** | Ekstensi baru saja di-*reload* di `chrome://extensions` | Tekan **F5** (Refresh) pada tab situs AI. |
| **Klik `▶︎ Start` tidak mengetikkan prompt** | Kode ekstensi di memori browser belum diperbarui | Buka `chrome://extensions`, klik ikon **Reload (⟳)** pada **snapgentV3**, lalu tekan **F5** di tab AI. |
