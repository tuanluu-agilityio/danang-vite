---
agent: agent
description: Thêm khóa dịch mới vào đủ 9 ngôn ngữ và kiểm tra không thiếu khóa
argument-hint: Danh sách khóa + nghĩa tiếng Việt
---

# Thêm khóa i18n

Khóa cần thêm: `${input:keys:khóa = nghĩa tiếng Việt, …}`

1. Đọc `.github/instructions/i18n-narration.instructions.md`; xem các khóa cùng nhóm hiện có trong `src/i18n/locales/vi.json` để giữ giọng văn và độ dài.
2. Viết bản `vi`, rồi dịch tự nhiên sang `en`, `ko`, `ja`, `zh`, `th`, `ar`, `hi`, `ru`. Nhãn nút ngắn ngang bản `vi`.
3. Nhiều khóa → dùng script một lần như `scripts/add-tunnel-locales.mjs` thay vì sửa tay 9 file.
4. Kiểm tra mọi file có cùng tập khóa:
   ```bash
   node -e "const fs=require('fs'),d='src/i18n/locales/',L=fs.readdirSync(d),K=f=>new Set(Object.keys(JSON.parse(fs.readFileSync(d+f,'utf8'))));const vi=K('vi.json');for(const f of L){const k=K(f);const miss=[...vi].filter(x=>!k.has(x));if(miss.length)console.log(f,'thiếu',miss)}console.log('xong')"
   ```
5. Nếu khóa là `<prefix>Stops`: số điểm dừng phải trùng `views/tourStops.ts`, và cân nhắc cập nhật `scripts/narration/`.
6. `npm run typecheck`.
