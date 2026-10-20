# Kết quả kiểm tra (2026-10-20)

Chromium + SwiftShader, khung 480×270. Draw call = renderer.info.render.calls (gồm bóng đổ, phản chiếu nước, bloom), trung vị 5 khung hình.

## Draw call: bản gốc vs bản Vite

```
┌─────────┬────────────────────┬─────────┬──────────┬───────┐
│ (index) │ góc nhìn           │ bản gốc │ bản Vite │ chênh │
├─────────┼────────────────────┼─────────┼──────────┼───────┤
│ 0       │ 'overview|ngày'    │ 275     │ 275      │ 0     │
│ 1       │ 'head|ngày'        │ 298     │ 298      │ 0     │
│ 2       │ 'tail|ngày'        │ 231     │ 231      │ 0     │
│ 3       │ 'drive|ngày'       │ 212     │ 212      │ 0     │
│ 4       │ 'bird|ngày'        │ 260     │ 260      │ 0     │
│ 5       │ 'walk|ngày'        │ 211     │ 211      │ 0     │
│ 6       │ 'tpBay|ngày'       │ 270     │ 270      │ 0     │
│ 7       │ 'tpWater|ngày'     │ 115     │ 115      │ 0     │
│ 8       │ 'tpDrive|ngày'     │ 124     │ 124      │ 0     │
│ 9       │ 'tpBoth|ngày'      │ 274     │ 274      │ 0     │
│ 10      │ 'ttlOverview|ngày' │ 232     │ 232      │ 0     │
│ 11      │ 'ttlBase|ngày'     │ 128     │ 128      │ 0     │
│ 12      │ 'ttlDeck|ngày'     │ 144     │ 144      │ 0     │
│ 13      │ 'ttlBoth|ngày'     │ 239     │ 239      │ 0     │
│ 14      │ 'shOverview|ngày'  │ 260     │ 260      │ 0     │
│ 15      │ 'shTop|ngày'       │ 202     │ 202      │ 0     │
│ 16      │ 'shBank|ngày'      │ 219     │ 219      │ 0     │
│ 17      │ 'shDeck|ngày'      │ 194     │ 194      │ 0     │
│ 18      │ 'overview|đêm'     │ 298     │ 298      │ 0     │
│ 19      │ 'head|đêm'         │ 319     │ 319      │ 0     │
│ 20      │ 'tail|đêm'         │ 258     │ 258      │ 0     │
│ 21      │ 'drive|đêm'        │ 239     │ 239      │ 0     │
│ 22      │ 'bird|đêm'         │ 289     │ 289      │ 0     │
│ 23      │ 'walk|đêm'         │ 237     │ 237      │ 0     │
│ 24      │ 'tpBay|đêm'        │ 290     │ 290      │ 0     │
│ 25      │ 'tpWater|đêm'      │ 136     │ 136      │ 0     │
│ 26      │ 'tpDrive|đêm'      │ 144     │ 144      │ 0     │
│ 27      │ 'tpBoth|đêm'       │ 306     │ 306      │ 0     │
│ 28      │ 'ttlOverview|đêm'  │ 253     │ 253      │ 0     │
│ 29      │ 'ttlBase|đêm'      │ 148     │ 148      │ 0     │
│ 30      │ 'ttlDeck|đêm'      │ 164     │ 164      │ 0     │
│ 31      │ 'ttlBoth|đêm'      │ 260     │ 260      │ 0     │
│ 32      │ 'shOverview|đêm'   │ 306     │ 306      │ 0     │
│ 33      │ 'shTop|đêm'        │ 248     │ 248      │ 0     │
│ 34      │ 'shBank|đêm'       │ 265     │ 265      │ 0     │
│ 35      │ 'shDeck|đêm'       │ 240     │ 240      │ 0     │
└─────────┴────────────────────┴─────────┴──────────┴───────┘
Draw call trùng khớp bản gốc ở mọi góc nhìn.
```

## Tour

```

=== Bản gốc ===
dragon 8 điểm dừng, camera thấp nhất 3 m → LỖI
   - đường bay chạm mô hình 1 lần: [{"u":0.213,"obj":"Mesh","at":[-282.2,9.9,-2.2]}]
tp     7 điểm dừng, camera thấp nhất 3 m → đạt
ttl    7 điểm dừng, camera thấp nhất 3.22 m → đạt
sh     6 điểm dừng, camera thấp nhất 3 m, cầu tự quay (“Dừng xe, hạ barie”) → đạt

=== Bản Vite ===
dragon 8 điểm dừng, camera thấp nhất 3 m → LỖI
   - đường bay chạm mô hình 1 lần: [{"u":0.213,"obj":"Mesh","at":[-282.2,9.9,-2.2]}]
tp     7 điểm dừng, camera thấp nhất 3 m → đạt
ttl    7 điểm dừng, camera thấp nhất 3.22 m → đạt
sh     6 điểm dừng, camera thấp nhất 3 m, cầu tự quay (“Dừng xe, hạ barie”) → đạt
dragon: đường bay và tiêu đề trùng khớp bản gốc
tp: đường bay và tiêu đề trùng khớp bản gốc
ttl: đường bay và tiêu đề trùng khớp bản gốc
sh: đường bay và tiêu đề trùng khớp bản gốc
```

Điểm chạm ở Tour Cầu Rồng (x≈-282, y≈10, gần đuôi rồng) có ở cả bản gốc, đường bay hai bản trùng nhau, nên đây không phải lỗi do chuyển đổi.
