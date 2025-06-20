# Quick Start Guide - WhatsApp Webhook API

## 🚀 Mulai dalam 5 Menit

### Prasyarat
- Python 3.11+
- Node.js 20.18.0+
- WhatsApp account

### Langkah Cepat

#### 1. Setup Environment
```bash
# Aktifkan virtual environment
source venv/bin/activate

# Install dependencies (sudah terinstall)
pip install -r requirements.txt
npm install
```

#### 2. Start Services

**Terminal 1 - WhatsApp Service:**
```bash
node whatsapp-service.js
```

**Terminal 2 - Flask Backend:**
```bash
python src/main.py
```

#### 3. Login WhatsApp
1. Buka browser: `http://localhost:5000`
2. Klik "Refresh Status"
3. Scan QR code dengan WhatsApp di ponsel
4. Status berubah menjadi "Terhubung"

#### 4. Test API
```bash
# Kirim pesan test
curl -X POST http://localhost:5000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"to": "6281234567890", "message": "Hello from API!"}'
```

## 📋 Checklist Setup

- [ ] Python virtual environment aktif
- [ ] Dependencies terinstall (pip & npm)
- [ ] WhatsApp service berjalan (port 3000)
- [ ] Flask backend berjalan (port 5000)
- [ ] Web interface dapat diakses
- [ ] QR code berhasil di-scan
- [ ] Status menunjukkan "Terhubung"
- [ ] Test message berhasil dikirim

## 🔧 Troubleshooting Cepat

| Masalah | Solusi |
|---------|--------|
| Port 3000 sudah digunakan | `kill $(lsof -ti:3000)` |
| QR code tidak muncul | Refresh halaman, cek console browser |
| Service unavailable | Restart kedua service |
| Message gagal kirim | Cek format nomor (6281234567890) |

## 📚 API Endpoints

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/api/whatsapp/status` | Cek status koneksi |
| POST | `/api/whatsapp/send` | Kirim pesan |
| GET | `/api/whatsapp/qr` | Get QR code |
| POST | `/api/whatsapp/logout` | Logout WhatsApp |

## 🌐 Web Interface

Akses: `http://localhost:5000`

**Fitur:**
- QR code login
- Real-time status monitor
- Test message sender
- Message history
- API documentation

## 📞 Support

Jika mengalami masalah, cek:
1. Console output kedua service
2. Browser console untuk error JavaScript
3. Network connectivity
4. WhatsApp account status

---
**Happy Coding! 🎉**

