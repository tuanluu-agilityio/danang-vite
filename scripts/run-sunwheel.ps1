<#
  Chạy tự động các giai đoạn của prompts/vong-quay-mat-troi.md (Vòng quay Mặt Trời) bằng Claude Code không tương tác (claude -p).
  Giai đoạn 0 (đặc tả) và 1 (config, khung SunWheel) đã làm và commit (52ad574, b4eac62): mặc định chạy từ GĐ2.

  Mỗi giai đoạn:
    1. Agent làm (ngữ cảnh mới, model riêng): sửa code + npm run build, KHÔNG chạy test nặng, KHÔNG commit.
    2. Script tự chạy build + các test của giai đoạn, ghi log (agent không tốn token chờ test 10–20 phút).
    3. Agent kiểm tra (chỉ đọc) chấm theo điều kiện "Kiểm tra" của giai đoạn → KET_QUA: DAT / LOI.
    4. LOI → agent làm sửa lại (tối đa -MaxRetries lần), chạy lại test. DAT → script commit.
  Điểm dừng để người xem tự kiểm tra (đối chiếu ảnh tham chiếu): sau GĐ2 (hình học) và GĐ4 (LED đêm); tắt bằng -NoCheckpoint.

  Cách chạy (từ thư mục gốc repo, trên nhánh feature/sun-wheel, cây làm việc sạch):
    powershell -ExecutionPolicy Bypass -File scripts/run-sunwheel.ps1              # GĐ2 → GĐ8
    powershell -ExecutionPolicy Bypass -File scripts/run-sunwheel.ps1 -From 4      # chạy tiếp từ GĐ4
    powershell -ExecutionPolicy Bypass -File scripts/run-sunwheel.ps1 -From 2 -To 2 -BudgetUsd 5
    powershell -ExecutionPolicy Bypass -File scripts/run-sunwheel.ps1 -DryRun      # chỉ kiểm tra điều kiện + in kế hoạch, không gọi claude
    powershell -ExecutionPolicy Bypass -File scripts/run-sunwheel.ps1 -From 2 -Resume   # chấm lại phần việc chưa commit của GĐ2 (không bắt agent làm lại)
  Log: tests/screens/sunwheel-logs/ (thư mục tests/screens/ không commit). Ảnh tham chiếu: prompts/tham-chieu/sun-wheel/ (không commit).
#>
param(
  [int]$From = 2,
  [int]$To = 8,
  [double]$BudgetUsd = 0,      # giới hạn chi phí mỗi lần gọi claude (USD); 0 = không giới hạn
  [int]$MaxRetries = 1,        # số lần cho agent sửa khi kiểm tra báo LOI
  [switch]$NoCheckpoint,
  [switch]$DryRun,
  [switch]$Resume              # giữ thay đổi chưa commit của giai đoạn -From: bỏ bước agent làm lần đầu, chạy test + kiểm tra luôn
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$Spec = 'prompts/vong-quay-mat-troi.md'
$LogDir = 'tests/screens/sunwheel-logs'
$Baseline = 'tests/screens/chuan-truoc-sunwheel.txt'
$Gd1Log = "$LogDir/gd1-test-drawcalls.log"        # đo ở GĐ1 (khung rỗng, chưa mesh): 58/58 khớp bảng GD8 trong tests/KET-QUA.md
$Refs = 'prompts/tham-chieu/sun-wheel'
$Branch = 'feature/sun-wheel'
$Trailer = 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>'

# ============================ Bảng giai đoạn ============================
# sec: mục đặc tả agent cần đọc · tests: script npm chạy sau khi agent làm · testsFirst: chạy test trước agent (GĐ8 ghi kết quả vào tài liệu)
# refs: giai đoạn có hình dạng cần đối chiếu ảnh tham chiếu (agent chụp ảnh cảnh rồi so với ảnh trong $Refs)
$Phases = @(
  @{ n = 1; title = 'config + khung SunWheel';                 model = 'sonnet'; effort = 'medium'; sec = '1, 5, 9, 10 (Giai đoạn 1)';                tests = @('test:drawcalls', 'test:sunwheel') },
  @{ n = 2; title = 'hình học: bệ, ga, tháp đỡ, vành, cabin';   model = 'opus';   effort = 'high';   sec = '1.3, 2, 5, 9, 10 (Giai đoạn 2)';          tests = @('test:drawcalls', 'test:sunwheel'); refs = $true; checkpoint = $true },
  @{ n = 3; title = 'quay, tốc độ, góc nhìn sw*';              model = 'sonnet'; effort = 'medium'; sec = '3, 5, 9, 10 (Giai đoạn 3), 11';           tests = @('test:drawcalls', 'test:sunwheel') },
  @{ n = 4; title = 'LED ban đêm + kiểu show';                 model = 'opus';   effort = 'high';   sec = '4, 9, 10 (Giai đoạn 4)';                  tests = @('test:drawcalls', 'test:sunwheel'); refs = $true; checkpoint = $true },
  @{ n = 5; title = 'ngồi cabin';                              model = 'sonnet'; effort = 'high';   sec = '5, 10 (Giai đoạn 5), 11';                 tests = @('test:sunwheel') },
  @{ n = 6; title = 'thời tiết: dừng khi bão, lắc gió, ướt';   model = 'sonnet'; effort = 'medium'; sec = '6, 9, 10 (Giai đoạn 6), 11';              tests = @('test:drawcalls', 'test:weather', 'test:sunwheel') },
  @{ n = 7; title = 'panel, i18n 9 ngôn ngữ, Tour + thuyết minh'; model = 'sonnet'; effort = 'medium'; sec = '7, 9, 10 (Giai đoạn 7)';             tests = @('test:drawcalls', 'test:tour', 'test:voice', 'test:sunwheel') },
  @{ n = 8; title = 'hoàn tất: test đủ bộ + tài liệu';         model = 'haiku';  effort = 'low';    sec = '10 (Giai đoạn 8), 11, 13';                 tests = @('test:drawcalls', 'test:tour', 'test:tunnel', 'test:riverfront', 'test:voice', 'test:weather', 'test:sunwheel'); testsFirst = $true }
)
$VerifyModel = 'sonnet'; $VerifyEffort = 'medium'

# Quyền: agent làm được sửa file (acceptEdits) + các lệnh dưới; mọi thứ khác bị từ chối (--permission-prompts none), không treo chờ hỏi
# node *: gồm node scripts/gen-narration.mjs (npm run gen:voice) và các script chụp ảnh
$WorkTools = @('Bash(npm run build)', 'Bash(npm run typecheck)', 'Bash(node *)', 'Bash(git diff*)', 'Bash(git status*)', 'Bash(git log*)')
$VerifyTools = @('Bash(git diff*)', 'Bash(git status*)', 'Bash(git log*)')
$SystemNote = 'Chạy lệnh bằng công cụ Bash (không dùng PowerShell). Không chạy git commit, git push, git checkout, git stash. Không hỏi lại người dùng: không ai trả lời; thiếu thông tin thì chọn phương án an toàn nhất trong đặc tả (số ước lượng đã có trong config) và ghi rõ trong báo cáo.'

function Stop-Run([string]$msg) { Write-Host "DỪNG: $msg" -ForegroundColor Red; exit 1 }
function Say([string]$msg, [string]$color = 'Cyan') { Write-Host $msg -ForegroundColor $color }

# Gọi claude -p; trả về @{ text; cost }. Prompt đặt TRƯỚC các tùy chọn (--allowedTools nhận nhiều giá trị liền sau nó).
# PowerShell 5.1 truyền sai tham số có nháy kép cho chương trình ngoài → đổi thành nháy đơn (kết luận của agent kiểm tra hay có "…")
function Invoke-Claude([string]$prompt, [string]$model, [string]$effort, [string[]]$tools, [string]$log) {
  $prompt = $prompt.Replace('"', "'")
  $a = @($prompt, '-p', '--model', $model, '--effort', $effort, '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none', '--output-format', 'json', '--append-system-prompt', $SystemNote)
  if ($BudgetUsd -gt 0) { $a += @('--max-budget-usd', [string]$BudgetUsd) }
  $a += @('--allowedTools') + $tools
  if ($DryRun) { Say "    [DryRun] claude --model $model --effort $effort → $log" 'DarkGray'; return @{ text = 'KET_QUA: DAT'; cost = 0 } }
  $raw = (& claude @a) -join "`n"
  Set-Content -Path $log -Value $raw -Encoding UTF8
  try { $j = $raw | ConvertFrom-Json; return @{ text = [string]$j.result; cost = [double]$j.total_cost_usd } }
  catch { return @{ text = $raw; cost = 0 } }   # không phải JSON (lỗi xác thực, hết hạn mức…): trả nguyên văn để báo lỗi
}
function Get-Verdict([string]$text) {
  $m = [regex]::Matches($text, 'KET_QUA:\s*(DAT|LOI)[^\r\n]*')
  if ($m.Count -eq 0) { return @{ ok = $false; line = 'KET_QUA: LOI (agent không in dòng kết quả)' } }
  $last = $m[$m.Count - 1]
  return @{ ok = ($last.Groups[1].Value -eq 'DAT'); line = $last.Value }
}
# Chạy npm qua cmd để log giữ nguyên UTF-8 (chuyển hướng của PowerShell 5.1 ghi UTF-16)
function Invoke-Npm([string]$script, [string]$log) {
  if ($DryRun) { Say "    [DryRun] npm run $script → $log" 'DarkGray'; return $true }
  Say "    npm run $script …" 'DarkGray'
  cmd /c "npm run $script > `"$log`" 2>&1"
  return ($LASTEXITCODE -eq 0)
}
function Invoke-Tests($p, [int]$try) {
  $logs = @(); $okAll = $true
  $b = "$LogDir/gd$($p.n)-l$try-build.log"; $logs += $b
  if (-not (Invoke-Npm 'build' $b)) { return @{ ok = $false; logs = $logs; note = 'npm run build lỗi' } }
  foreach ($t in $p.tests) {
    $l = "$LogDir/gd$($p.n)-l$try-$($t -replace ':', '-').log"; $logs += $l
    if (-not (Invoke-Npm $t $l)) { $okAll = $false }
  }
  return @{ ok = $okAll; logs = $logs; note = $(if ($okAll) { 'mọi test thoát mã 0' } else { 'có test thoát mã khác 0' }) }
}

# ============================ Kiểm tra điều kiện ============================
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Stop-Run 'không tìm thấy lệnh claude' }
if (-not (Test-Path $Spec)) { Stop-Run "không có $Spec" }
if (-not (Select-String -Path $Spec -Pattern '^## 12b' -Quiet)) { Stop-Run "chưa có mục '## 12b' (câu trả lời của người dùng) trong $Spec" }
if ($From -lt 1 -or $To -gt 8 -or $From -gt $To) { Stop-Run "-From/-To không hợp lệ ($From..$To), phải trong 1..8" }
$cur = (git branch --show-current).Trim()
if ($cur -ne $Branch) { Stop-Run "đang ở nhánh '$cur', cần '$Branch' (git checkout $Branch)" }
if (-not $Resume -and (git status --porcelain)) { Stop-Run 'cây làm việc chưa sạch: commit hoặc bỏ thay đổi trước khi chạy (hoặc dùng -Resume để chấm lại phần việc đang có của giai đoạn -From)' }
if ($From -ge 2 -and -not (git log --oneline --grep='giai đoạn 1' -i | Select-Object -First 1)) { Stop-Run 'chưa có commit giai đoạn 1 (khung SunWheel) trên nhánh này' }
New-Item -ItemType Directory -Force $LogDir | Out-Null
if (-not (Test-Path $Refs) -or -not (Get-ChildItem $Refs -File -ErrorAction SilentlyContinue)) {
  Say "Cảnh báo: không có ảnh tham chiếu ở $Refs (thư mục không commit). GĐ2 và GĐ4 sẽ chỉ dựa vào mô tả ở mục 1.3 của đặc tả." 'Yellow'
}

# Chuẩn draw call = số đo trên code TRƯỚC khi giai đoạn $From thêm mesh. Hợp lệ = có bảng console.table của tests/drawcalls.mjs (dòng 'overview|ngày').
# Thiếu file: lấy từ log GĐ1 (khung rỗng, không mesh) nếu có; không thì đo lại trên HEAD sạch (10–20 phút).
$baselineOk = (Test-Path $Baseline) -and (Select-String -Path $Baseline -Pattern 'overview\|' -Quiet)
if (-not $baselineOk -and -not $DryRun) {
  if (Test-Path $Baseline) { Remove-Item $Baseline; Say "Đã xoá $Baseline vì không có bảng draw call (lần đo trước lỗi)" 'Yellow' }
  if ((Test-Path $Gd1Log) -and (Select-String -Path $Gd1Log -Pattern 'overview\|' -Quiet) -and $From -ge 2) {
    Copy-Item $Gd1Log $Baseline -Force; Say "Chuẩn draw call lấy từ log GĐ1: $Gd1Log" 'DarkGray'
  } else {
    if ($Resume) { Stop-Run "thiếu chuẩn draw call hợp lệ ($Baseline); phải đo trên HEAD sạch (không -Resume)" }
    Say '== Đo chuẩn draw call trước khi sửa (10–20 phút) =='
    if (-not (Invoke-Npm 'build' "$LogDir/chuan-build.log")) { Stop-Run 'build lỗi trên code hiện tại' }
    if (-not (Invoke-Npm 'test:drawcalls' $Baseline)) {
      Copy-Item $Baseline "$LogDir/chuan-loi.log" -Force; Remove-Item $Baseline
      Stop-Run "test:drawcalls lỗi, xem $LogDir/chuan-loi.log (thiếu Chromium thì chạy: npx playwright install chromium)"
    }
  }
}

# ============================ Chạy từng giai đoạn ============================
$summary = @(); $totalCost = 0.0
foreach ($p in $Phases | Where-Object { $_.n -ge $From -and $_.n -le $To }) {
  $n = $p.n; $start = (git rev-parse HEAD).Trim()
  Say "`n== Giai đoạn ${n}: $($p.title) ($($p.model), effort $($p.effort)) ==" 'Yellow'

  $work = @"
Đọc .github/copilot-instructions.md, .github/memory-bank/activeContext.md, .github/memory-bank/decisions.md (D-014), rồi đọc $Spec mục $($p.sec), mục 12b và mục 1.2, 1.3.
Chỉ làm Giai đoạn $n. Không làm việc của giai đoạn sau. Mọi số đo ở CONFIG.sunWheel trong src/config.ts; số ước lượng giữ nguyên chú thích (ước lượng).
Ngân sách draw call: góc nhìn cũ tăng tối đa +2 so với chuẩn ở $Baseline; góc sw* theo mục 9; ngày và đêm chênh 0; không rand() mới, không đèn mới.
Mở rộng tests/sunwheel-check.mjs bằng các kiểm tra của Giai đoạn $n (mục 11), không xóa kiểm tra cũ. Góc nhìn sw* mới phải thêm vào VIEWS của tests/drawcalls.mjs.
Sau khi sửa: chạy npm run build và sửa tới khi qua. KHÔNG chạy npm run test:drawcalls, test:tour, test:tunnel, test:riverfront, test:voice, test:weather, test:sunwheel: script bên ngoài sẽ chạy và chấm.
Khi giai đoạn có bước nhìn kết quả: viết script Node + Playwright (dùng tests/lib.mjs) chụp ảnh vào tests/screens/sunwheel-gd$n/, rồi mở từng ảnh bằng công cụ Read và soát theo đặc tả.
Cập nhật .github/memory-bank/activeContext.md: đã làm gì ở Giai đoạn $n, còn gì dở, bước tiếp theo.
Báo cáo ngắn: file đã sửa, quyết định đã chọn, việc chưa làm được. Dòng cuối cùng in đúng một trong hai: KET_QUA: DAT hoặc KET_QUA: LOI kèm lý do.
"@
  if ($p.refs) {
    $work += "`nĐối chiếu hình dạng: mở ảnh tham chiếu trong $Refs bằng công cụ Read (a1 flycam ngày, a2 flycam chạng vạng, n1 chính diện đêm, n2 nhìn lên từ chân, n3 nhìn nghiêng; a3 là phối cảnh quy hoạch đề xuất, KHÔNG dựng) và so với ảnh cảnh bạn chụp cùng góc. Ghi trong báo cáo từng chi tiết còn khác ảnh. Không đưa ảnh vào src/ hay public/."
  }
  if ($n -eq 7) { $work += "`nThuyết minh: dùng node scripts/gen-narration.mjs (npm run gen:voice) cho vi, en, ru; commit gồm public/voice/ và manifest. Nếu không sinh được clip (mạng, msedge-tts), nói rõ trong báo cáo thay vì giả vờ xong." }
  if ($p.testsFirst) {
    $work = $work -replace 'KHÔNG chạy npm run test:[^\r\n]*', "Không chạy test: script đã chạy đủ bộ, log ở $LogDir/gd$n-l0-*.log. Dùng các log đó để cập nhật tests/KET-QUA.md (bảng draw call mới gồm cả góc nhìn sw*), README mục Cấu trúc (thêm src/bridges/sun-wheel/), .github/memory-bank/progress.md và systemPatterns.md. Ghi số thật, kể cả lỗi."
  }

  $ok = $false; $verdictLine = ''; $phaseCost = 0.0; $tr = @{ ok = $false; logs = @(); note = 'chưa chạy test' }
  for ($try = 0; $try -le $MaxRetries; $try++) {
    if ($p.testsFirst -and $try -eq 0) { $tr = Invoke-Tests $p 0 }
    $prompt = $work
    if ($try -gt 0) {
      $prompt = "Giai đoạn $n chưa đạt. Kết luận của người kiểm tra: $verdictLine`nLog test: $($tr.logs -join ', '). Đọc log, tìm nguyên nhân gốc rồi sửa. Không nới điều kiện kiểm tra.`n`n" + $work
    }
    if ($Resume -and $n -eq $From -and $try -eq 0) {
      Say '    -Resume: giữ phần việc chưa commit, bỏ qua bước agent làm' 'DarkGray'
    } else {
      $r = Invoke-Claude $prompt $p.model $p.effort $WorkTools "$LogDir/gd$n-l$try-lam.json"
      $phaseCost += $r.cost
      $v = Get-Verdict $r.text
      if (-not $v.ok) { $verdictLine = "agent làm tự báo: $($v.line)"; Say "    $verdictLine" 'Red'; continue }
    }

    if (-not ($p.testsFirst -and $try -eq 0)) { $tr = Invoke-Tests $p $try }
    $check = @"
Bạn là người kiểm tra, KHÔNG sửa file nào. Đọc $Spec mục 9, mục 10 phần Giai đoạn $n, mục 11 và 12b.
Chuẩn draw call trước giai đoạn này: $Baseline. Log của lần chạy này: $($tr.logs -join ', ') (script ghi nhận: $($tr.note)).
Chạy git status và git diff $start để xem thay đổi của giai đoạn.
Chấm theo điều kiện kiểm tra của Giai đoạn ${n}: draw call so với chuẩn (góc cũ tăng tối đa +2, ngày/đêm chênh 0, góc sw* theo mục 9), test qua, không lỗi console, không đụng chuỗi rand() trong code cũ, không thêm đèn/thư viện/ảnh ngoài, công trình bám CONFIG.sunWheel (không số rời), đủ 9 ngôn ngữ nếu có khóa mới, không làm việc của giai đoạn khác, số ước lượng vẫn ghi (ước lượng). Báo cáo trung thực việc chưa làm hoặc chưa có bằng chứng.
Báo cáo ngắn từng điều kiện. Dòng cuối cùng in đúng một trong hai: KET_QUA: DAT hoặc KET_QUA: LOI kèm lý do ngắn.
"@
    $c = Invoke-Claude $check $VerifyModel $VerifyEffort $VerifyTools "$LogDir/gd$n-l$try-kiemtra.json"
    $phaseCost += $c.cost
    $v = Get-Verdict $c.text; $verdictLine = $v.line
    Say "    Kiểm tra: $verdictLine" $(if ($v.ok) { 'Green' } else { 'Red' })
    if ($v.ok) { $ok = $true; break }
  }
  $totalCost += $phaseCost
  $summary += [pscustomobject]@{ 'GĐ' = $n; 'Nội dung' = $p.title; 'Model' = $p.model; 'Kết quả' = $(if ($ok) { 'ĐẠT' } else { 'LỖI' }); 'Chi phí (USD)' = [math]::Round($phaseCost, 2) }

  if (-not $ok) {
    $summary | Format-Table -AutoSize
    Stop-Run "Giai đoạn $n chưa đạt sau $($MaxRetries + 1) lần. Thay đổi vẫn còn trong cây làm việc (chưa commit). Xem $LogDir/gd$n-*; sửa tay hoặc bỏ (git checkout . ; git clean -fd) rồi chạy lại: -From $n"
  }
  if (-not $DryRun) {
    git add -A
    git commit -q -m "feat(sun-wheel): giai đoạn $n — $($p.title)" -m $Trailer
    if ($LASTEXITCODE -ne 0) { Stop-Run "git commit lỗi ở giai đoạn $n" }
    Say "    Đã commit: $((git log -1 --format='%h %s').Trim())" 'Green'
  }

  if ($p.checkpoint -and -not $NoCheckpoint -and $n -lt $To) {
    Say "`n-- Điểm dừng sau Giai đoạn ${n}: tự xem trước khi đi tiếp --" 'Magenta'
    Say "   npm run dev → mở http://localhost:5173/?test, chọn công trình Sun Wheel, xem ngày/đêm, so với ảnh ở $Refs"
    Say "   Ảnh agent đã chụp: tests/screens/sunwheel-gd$n/   ·   Thay đổi: git show --stat HEAD"
    $ans = Read-Host '   Gõ c để chạy tiếp, phím khác để dừng'
    if ($ans -ne 'c') { $summary | Format-Table -AutoSize; Say "Đã dừng. Chạy tiếp bằng: -From $($n + 1)" 'Magenta'; exit 0 }
  }
}

$summary | Format-Table -AutoSize
Say ("Tổng chi phí ước tính: {0:N2} USD. Log: $LogDir" -f $totalCost) 'Green'
Say "Xong. Bước tiếp theo (tay): review (/code-review high) rồi push + tạo PR." 'Green'
