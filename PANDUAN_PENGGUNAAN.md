# Panduan Penggunaan Snapgent (snapgentV3)

Panduan ini menjelaskan langkah-langkah instalasi, konfigurasi, dan penggunaan **Snapgent (`snapgentV3`)** untuk menghubungkan AI berbasis web (ChatGPT, Claude, Gemini, Qwen, Kimi, Z.ai, Grok, Arena, Meta AI) langsung ke project **VS Code** atau **Roblox Studio** di komputer Anda tanpa memerlukan API key berbayar.

---

## 1. Instalasi Ekstensi Browser

1. Buka browser berbasis Chromium (**Google Chrome**, **Microsoft Edge**, atau **Brave**).
2. Buka halaman manajemen ekstensi:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Aktifkan **Developer mode** (*Mode pengembang*) di pojok kanan atas.
4. Klik tombol **Load unpacked** (*Muat yang belum dikemas*).
5. Pilih folder **`snapgent-extension`** yang berada di dalam direktori project ini (`c:\laragon\www\snapgent\snapgent-extension`).
6. *(Jika ekstensi sudah terpasang sebelumnya)* Klik ikon **Reload (⟳)** pada kartu ekstensi **Snapgent** untuk memuat pembaruan terbaru.

---

## 2. Menjalankan Local Bridge

Bridge bertugas menjembatani perintah dari ekstensi browser ke **VS Code** atau **Roblox Studio** di komputer Anda:

### Windows
1. Klik dua kali file **`start.bat`** (atau jalankan `.\start.bat` dari terminal di folder `c:\laragon\www\snapgent`).
2. Skrip akan otomatis menjalankan **`setup-config.ps1`** untuk mengonfigurasi **`config.json`** dan menyalakan bridge lokal di port `17613`.
3. **Biarkan jendela terminal tetap terbuka** (boleh di-*minimize*) selama Anda menggunakan Snapgent. Menutup jendela tersebut akan menghentikan bridge.

### macOS / Linux
Paket repository saat ini hanya menyertakan `bridge.exe` untuk Windows. `MacOS_Start.command` memeriksa apakah binary `bridge` native atau `bridge.py` tersedia, lalu berhenti dengan pesan yang jelas jika tidak ada. Karena itu, bridge belum dapat dijalankan pada macOS/Linux dari paket ini.

---

## 3. Menyiapkan Target (Windows: VS Code / Roblox Studio)

### A. Menggunakan Target VS Code *(Default)*
1. Buka aplikasi **Visual Studio Code**.
2. Buka folder project yang ingin Anda kerjakan melalui menu **File → Open Folder...**
3. Server **`vscode_mcp.py`** secara otomatis mendeteksi folder kerja VS Code yang sedang aktif dan menyediakan **24 tools**:
   - **Navigasi & Pembacaan**: `list_dir`, `list_tree`, `find_files`, `search_files`, `read_file`, `read_files`, `read_file_lines`, `get_file_info`, `get_file_outline`, `get_workspace_info`, `get_project_info`
   - **Pembuatan & Pengeditan**: `create_file`, `write_file`, `edit_file`, `create_directory`, `move_file`, `copy_file`
   - **Git**: `git_status`, `git_diff`, `git_log`, `git_branches`
   - **Eksekusi**: `run_command`, `run_python`, `run_tests`

### B. Menggunakan Target Roblox Studio *(Opsional)*
1. Buka **Roblox Studio** dan buka *place* project Anda.
2. Pastikan fitur **MCP Server** di pengaturan Roblox Studio sudah diaktifkan.
3. Saat `start.bat` dijalankan, `StudioMCP.exe` akan otomatis terdeteksi dan didaftarkan ke `config.json`.

---

## 4. Memulai Sesi Agent di Situs AI

1. Buka salah satu situs AI yang didukung pada tab browser:
   - **ChatGPT**: `https://chatgpt.com`
   - **Claude**: `https://claude.ai`
   - **Google Gemini**: `https://gemini.google.com`
   - **Qwen**: `https://chat.qwen.ai`
   - **Z.ai (GLM)**: `https://chat.z.ai`
   - **Kimi**: `https://www.kimi.ai`
   - **Grok**: `https://grok.com`
   - **LMSYS Arena**: `https://arena.ai` *(gunakan mode Direct)*
   - **Meta AI**: `https://www.meta.ai`
2. Pastikan Anda berada di **percakapan baru (New Chat)** yang masih kosong.
3. Di bagian atas kotak input chat, akan muncul **Status Bar Snapgent**:
   - Pilih target server pada dropdown (**VS Code** atau **Roblox Studio**).
   - Pastikan status bertuliskan **`Ready.`**
4. Klik tombol **`▶︎ Start`** pada bar Snapgent:
   - Snapgent akan otomatis mengirimkan prompt inisialisasi sistem (disamarkan sebagai chip **"Starting Up"**) dan mengambil daftar perintah (`list_commands`).
   - Tunggu beberapa detik hingga status bar berubah menjadi hijau **`Active · 24 tools · VS Code`**.
5. **Ketik instruksi Anda seperti biasa** di kotak chat AI, misalnya:
   - *"Analisa struktur project ini dan jelaskan fungsi tiap file utamanya."*
   - *"Cari penyebab bug pada fitur login lalu perbaiki dan jalankan unit test."*
   - *"Buatkan komponen tabel responsif baru di folder src/components."*
6. Selama AI bekerja:
   - Setiap perintah tool yang ditulis AI akan dieksekusi otomatis oleh Snapgent dan hasilnya dikirim balik ke AI hingga tugas selesai.
   - **Biarkan tab browser AI tetap terbuka/aktif** selama proses eksekusi berlangsung (jika tab di-*minimize* atau berpindah tab saat giliran eksekusi, Snapgent akan otomatis *Pause* dan melanjutkan begitu tab dibuka kembali).
   - Anda dapat menghentikan eksekusi kapan saja dengan menekan tombol **`■ Stop`** pada bar Snapgent.

---

## 5. Pengaturan Tambahan (Custom Prompt & Custom MCP Server)

Klik tombol **AI Selector / Menu** pada bar Snapgent atau klik ikon ekstensi **Snapgent** di toolbar browser lalu pilih **Settings**:
- **Switch AI Provider**: Berpindah cepat antar situs AI yang didukung.
- **Custom Instructions**: Menambahkan instruksi khusus permanen (misalnya: *"Selalu gunakan Bahasa Indonesia dan TypeScript strict mode"*).
- **MCP Servers (Addons)**: Menambahkan server MCP eksternal tambahan (seperti Blender MCP, filesystem tambahan, dsb.) melalui URL atau perintah lokal.

---

## 6. Pemecahan Masalah (Troubleshooting)

| Status di Bar / Popup | Penyebab | Solusi |
| :--- | :--- | :--- |
| **`Run start.bat`** / **`Bridge offline`** | `bridge.exe` belum berjalan di komputer | Jalankan `start.bat` dan biarkan jendelanya tetap terbuka. |
| **`Open a folder in VS Code`** | VS Code belum dibuka atau belum ada folder project yang dibuka | Buka VS Code lalu klik **File → Open Folder** pada project yang ingin dikerjakan. |
| **`No agent. Open a new chat.`** | Anda sedang membuka riwayat chat lama yang bukan sesi Snapgent | Buat percakapan baru (**New Chat**) di situs AI tersebut, lalu klik **`▶︎ Start`**. |
| **`Paused · open this tab`** | Tab AI berada di latar belakang saat agent bekerja | Kembalikan tab AI ke layar utama (*foreground*) agar agent melanjutkan pekerjaannya. |
| **`Reload this page`** | Ekstensi baru saja di-update/di-reload di `chrome://extensions` | Tekan `F5` / Refresh pada halaman chat AI. |
