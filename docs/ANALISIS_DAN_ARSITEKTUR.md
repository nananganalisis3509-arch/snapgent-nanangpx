# Analisis dan Dokumentasi Teknis Snapgent

Dokumen ini merangkum susunan kode, cara kerja, instalasi, konfigurasi, batasan, pengujian, dan temuan analisis pada Snapgent V3. Aplikasi terdiri dari ekstensi browser Chromium, bridge lokal, serta server MCP untuk workspace VS Code.

## Ringkasan

Snapgent menghubungkan percakapan di situs AI yang didukung dengan workspace VS Code pada komputer pengguna. Ekstensi membaca perintah terstruktur yang dibuat AI, mengirimkannya ke bridge melalui WebSocket lokal, lalu menampilkan hasil tool kembali ke percakapan. Bridge meneruskan permintaan ke server MCP yang dipilih.

Komponen pada repositori:

| Komponen | Lokasi | Tanggung jawab |
|---|---|---|
| Ekstensi browser | `snapgent-extension/` | UI sesi, integrasi provider, parser, loop agent, komunikasi bridge |
| Bridge Windows | `bridge.exe` | Penghubung WebSocket lokal dan server MCP |
| Server MCP VS Code | `vscode_mcp.py`, `vscode_mcp.exe` | 24 tool untuk workspace VS Code aktif |
| Setup Windows | `start.bat`, `setup-config.ps1` | Konfigurasi lokal dan menjalankan bridge |
| Launcher macOS/Linux | `MacOS_Start.command` | Menjalankan bridge native/source jika disediakan |
| Dokumentasi pemakai | `README.md`, `PANDUAN_PENGGUNAAN.md` | Instalasi dan penggunaan |

Paket ini hanya menyertakan executable bridge Windows. Launcher macOS/Linux menjelaskan bahwa binary native atau `bridge.py` belum tersedia. Karena itu, paket dapat digunakan secara lengkap di Windows.

## Persyaratan

- Google Chrome, Microsoft Edge, atau browser Chromium dengan dukungan Manifest V3.
- Windows untuk bridge yang disertakan.
- VS Code dengan folder workspace terbuka untuk target default.
- `bridge.exe`, `vscode_mcp.exe`, `start.bat`, dan folder `snapgent-extension` dari paket yang sama.
- Roblox Studio opsional, jika Studio MCP tersedia dan terdeteksi oleh setup Windows.
- Node.js untuk smoke test JavaScript dan Python untuk unit test server.

## Instalasi dan penggunaan

### Pasang ekstensi

1. Ekstrak seluruh paket ke folder tetap.
2. Buka `chrome://extensions` atau `edge://extensions`.
3. Aktifkan **Developer mode**.
4. Klik **Load unpacked**, pilih folder `snapgent-extension`.
5. Setelah perubahan kode, klik **Reload** pada ekstensi lalu refresh halaman AI.

### Jalankan bridge pada Windows

1. Jalankan `start.bat`.
2. Script menjalankan `setup-config.ps1` untuk menemukan server MCP VS Code dan Roblox opsional, lalu memperbarui `config.json` lokal.
3. Bridge mendengarkan pada loopback port `17613`. Biarkan jendela terminal terbuka.
4. Buka folder kerja yang ingin digunakan di VS Code.

`config.json` berisi path mesin lokal dan dikecualikan dari Git. Jangan commit konfigurasi lokal atau mengganti path contoh dengan path mesin lain.

### Mulai sesi AI

1. Buka situs AI yang didukung dan buat percakapan baru.
2. Pastikan workspace yang benar terbuka di VS Code.
3. Klik **Start** dan tunggu status tool aktif.
4. Berikan instruksi dalam bahasa biasa. Ekstensi mengirim perintah AI, menerima hasil tool, dan melanjutkan loop sampai AI selesai atau sesi dihentikan.
5. Gunakan **Stop** untuk menghentikan loop. Beberapa provider memerlukan tab foreground selama agent bekerja.

## Provider browser

Host dan content script ditentukan di `snapgent-extension/manifest.json`; pemetaan provider juga digunakan oleh `snapgent-extension/background.js`.

- ChatGPT: `chatgpt.com`, `chat.openai.com`
- Claude: `claude.ai`
- DeepSeek: `chat.deepseek.com`, `deepseek.com`
- Gemini: `gemini.google.com`
- Kimi: `kimi.ai`, `www.kimi.ai`
- GLM/Z.ai: `chat.z.ai`
- Qwen: `chat.qwen.ai`
- Arena: `arena.ai` (mode Direct)
- Meta AI: `meta.ai`, `www.meta.ai`
- Ptero: `ptero.pro`
- Grok: `grok.com`

DOM situs AI dapat berubah dan memerlukan pembaruan selector atau mekanisme submit provider.

## Arsitektur dan aliran data

```text
Percakapan AI di browser
    │ perintah terstruktur
    ▼
Provider content script ── core/parser.js ── core/main.js
    │ pesan runtime ekstensi
    ▼
background.js ── WebSocket ws://127.0.0.1:17613
    ▼
Bridge lokal ── MCP stdio
    ▼
Server MCP terpilih (VS Code atau Roblox jika tersedia)
    │ hasil tool
    └────────────────────────────── kembali ke AI sebagai feedback
```

### Ekstensi browser

- `manifest.json`: permission, host, ikon, popup, dan susunan script provider.
- `background.js`: WebSocket ke bridge, status koneksi, routing pesan dan provider.
- `core/config.js`: prompt sistem, feedback, dan kategori tool.
- `core/parser.js`: parser command, format legacy, dan normalisasi feedback.
- `core/main.js`: state sesi, start/stop, agent loop, eksekusi, pemulihan, UI dan penyamaran prompt/hasil tool.
- `providers/*.js`: selector DOM, pembacaan pesan, submit input, dan deteksi generasi per situs.
- `providers/*-net.js` / `providers/*-cm.js`: tap MAIN world untuk data stream atau code block yang tidak lengkap pada DOM.
- `popup.html`, `popup.js`: pengaturan ekstensi dan server/provider.
- `overlay.css`: tampilan bar dan feedback.

Provider baru harus mengikuti antarmuka yang dipakai core. Integrasi memerlukan provider script, entri content script dan host pada manifest, serta pemetaan URL pada background. Perubahan provider sebaiknya tidak mengubah API provider lain.

### Bridge dan protokol MCP

Ekstensi berkomunikasi dengan bridge di `127.0.0.1:17613`. Bridge membaca konfigurasi MCP dan meneruskan operasi melalui stdio. `setup-config.ps1` mengatur `mcpServers.vscode` agar memakai `vscode_mcp.exe` atau source Python yang lebih baru. Jika Studio MCP terdeteksi, entri `roblox` juga disiapkan.

Server Python mengimplementasikan JSON-RPC MCP melalui stdin/stdout, mengiklankan tool, dan mengirim respons JSON per baris. Log tidak boleh ditulis ke stdout karena dapat merusak framing protokol.

## Tool workspace VS Code

Server menyediakan 24 tool:

| Kelompok | Tool |
|---|---|
| Informasi proyek | `get_workspace_info`, `get_project_info` |
| Navigasi/pencarian | `list_dir`, `list_tree`, `find_files`, `search_files`, `get_file_info`, `get_file_outline` |
| Pembacaan | `read_file`, `read_files`, `read_file_lines` |
| Perubahan file | `create_file`, `write_file`, `edit_file`, `create_directory`, `move_file`, `copy_file` |
| Git | `git_status`, `git_diff`, `git_log`, `git_branches` |
| Eksekusi | `run_command`, `run_project_script`, `run_tests` |

Path dinormalisasi terhadap root workspace aktif; path keluar root ditolak. Copy/move tidak menimpa tujuan, pembuatan file gagal jika sudah ada, dan edit teks memerlukan snippet unik kecuali `replace_all` diaktifkan. Hasil tool dibatasi ukurannya.

`run_command` menjalankan perintah OS pada workspace dan memiliki dampak setara akses terminal pengguna. `run_project_script` hanya menerima `build`, `check`, `format`, `lint`, `test`, atau `typecheck`, serta memeriksa `package.json`. Gunakan eksekusi hanya pada workspace yang dipercaya.

## Konfigurasi dan data lokal

- `config.json` berisi konfigurasi bridge per mesin dan di-ignore Git.
- `setup-config.ps1` mengubah entri MCP VS Code yang dikelola Snapgent dan entri Roblox yang terdeteksi; server lain dipertahankan.
- Preferensi ekstensi disimpan melalui `chrome.storage`.
- Extension meminta permission `storage`, akses ke host AI yang didukung, serta koneksi loopback ke bridge.
- Port default bridge `17613`; launcher macOS/Linux membaca `ZS_BRIDGE_PORT`, namun binary bridge yang disediakan adalah Windows.
- Jangan menyimpan token, kredensial, isi workspace sensitif, atau konfigurasi mesin lokal di repository.

## Keamanan dan batas operasional

- Server membatasi operasi file ke root folder aktif VS Code setelah resolusi path.
- Endpoint loopback hanya untuk komputer lokal; jalankan extension dan bridge yang dipercaya.
- Izin host dibutuhkan agar content script mengintegrasikan percakapan pada situs terkait.
- Perintah OS dan script project dapat mengubah file atau sistem. Tinjau instruksi dan hasil sebelum operasi berdampak.
- Jika terdapat beberapa jendela VS Code, pastikan workspace aktif adalah folder yang diinginkan.
- Kompatibilitas provider tergantung DOM situs pihak ketiga dan dapat berubah.
- macOS/Linux belum didukung paket ini sampai bridge native atau `bridge.py` tersedia.

## Pengujian dan pengembangan

Dari root repository, jalankan unit test MCP:

```powershell
py -3 -m unittest -v test_vscode_mcp.py
```

Dari folder `snapgent-extension/`, jalankan smoke test JavaScript:

```powershell
node test-parser.js
node test-meta.js
node test-chatgpt.js
```

Tes provider menggunakan DOM tiruan dan tidak menggantikan pengujian situs langsung. Untuk perubahan DOM, periksa sesi baru, start/stop, command, hasil tool, dan perpindahan tab foreground/background.

Pedoman perubahan:

1. Pisahkan logika DOM provider dari core.
2. Perbarui manifest dan pemetaan provider secara konsisten.
3. Jaga framing JSON-RPC MCP pada stdout.
4. Tambahkan regression test untuk bug yang dapat direproduksi.
5. Pastikan `config.json`, `logs/`, cache Python, dan artefak lokal tidak masuk commit.

## Pemecahan masalah

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Bridge offline | `start.bat` belum berjalan, proses berhenti, port terpakai | Jalankan ulang `start.bat`; lihat `logs/start.log` |
| Open a folder in VS Code | VS Code tidak aktif, folder tidak terbuka, atau state tidak terbaca | Buka folder target, lalu mulai sesi kembali |
| Bar Snapgent tidak muncul | Host tidak tercakup manifest atau extension belum reload | Periksa hostname, reload ekstensi, refresh halaman |
| AI tidak memakai tool | Sesi belum dimulai atau respons bukan format command | Klik Start pada chat baru dan periksa output/log ekstensi |
| Pembacaan file gagal | Path di luar root, file biner, atau file terlalu besar | Pakai path relatif dalam workspace dan pembacaan tersegmentasi |
| Launcher macOS/Linux berhenti | Paket hanya memiliki bridge Windows | Gunakan Windows atau sediakan bridge native/source |
| Workspace tidak terdeteksi | VS Code tidak aktif atau folder belum terbuka | Buka VS Code dan workspace sebelum menggunakan tool |

## Struktur repository

```text
.
├── assets/                     # Ikon dan aset promosi
├── docs/                       # Situs/dokumen dan analisis teknis
├── snapgent-extension/         # Source ekstensi Chromium
│   ├── core/                   # Config, parser, agent loop
│   ├── providers/              # Adaptor situs AI
│   ├── background.js           # WebSocket dan routing provider
│   ├── manifest.json           # Manifest V3
│   └── test-*.js               # Smoke test
├── vscode_mcp.py               # Source server MCP VS Code
├── test_vscode_mcp.py          # Unit test server MCP
├── setup-config.ps1            # Konfigurasi lokal Windows
├── start.bat                   # Launcher bridge Windows
├── MacOS_Start.command         # Pemeriksaan/launcher bridge native
├── bridge.exe                  # Bridge Windows
└── vscode_mcp.exe              # Server MCP VS Code Windows
```

## Temuan analisis dan perbaikan

### Deteksi proses VS Code macOS terlalu longgar

Pemeriksaan sebelumnya mencocokkan `/MacOS/Electron`, sehingga aplikasi Electron lain dapat dianggap sebagai VS Code. Pola kini dibatasi pada lokasi executable Visual Studio Code dan Code - Insiders; regression test mencegah pola umum tersebut kembali.

### Launcher non-Windows mencoba executable Windows

Launcher macOS/Linux sebelumnya dapat memilih `bridge.exe` dan mencoba mengeksekusinya. File tersebut bukan bridge native. Launcher kini hanya menerima binary `bridge` native atau `bridge.py`, serta memberikan penjelasan jika paket hanya berisi executable Windows.

