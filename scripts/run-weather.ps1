<#
  Chạy tự động 8 giai đoạn của prompts/ke-hoach-thoi-tiet.md bằng Claude Code không tương tác (claude -p).

  Mỗi giai đoạn:
    1. Agent làm (ngữ cảnh mới, model riêng): sửa code + npm run build, KHÔNG chạy test nặng, KHÔNG commit.
    2. Script tự chạy build + các test của giai đoạn, ghi log (agent không tốn token chờ test 10–20 phút).
    3. Agent kiểm tra (chỉ đọc) chấm theo điều kiện "Đạt khi" của giai đoạn → KET_QUA: DAT / LOI.
    4. LOI → agent làm sửa lại (tối đa -MaxRetries lần), chạy lại test. DAT → script commit.
  Điểm dừng để người xem tự kiểm tra: sau Giai đoạn 3 và 5 (tắt bằng -NoCheckpoint).

  Cách chạy (từ thư mục gốc repo, trên nhánh feature/weather, cây làm việc sạch):
    powershell -ExecutionPolicy Bypass -File scripts/run-weather.ps1              # GĐ1 → GĐ8
    powershell -ExecutionPolicy Bypass -File scripts/run-weather.ps1 -From 4      # chạy tiếp từ GĐ4
    powershell -ExecutionPolicy Bypass -File scripts/run-weather.ps1 -From 3 -To 3 -BudgetUsd 5
    powershell -ExecutionPolicy Bypass -File scripts/run-weather.ps1 -DryRun      # chỉ kiểm tra điều kiện + in kế hoạch, không gọi claude
    powershell -ExecutionPolicy Bypass -File scripts/run-weather.ps1 -From 1 -Resume   # chấm lại phần việc chưa commit của GĐ1 (không bắt agent làm lại)
  Log: tests/screens/weather-logs/ (thư mục tests/screens/ không commit).
#>
param(
  [int]$From = 1,
  [int]$To = 8,
  [double]$BudgetUsd = 0,      # giới hạn chi phí mỗi lần gọi claude (USD); 0 = không giới hạn
  [int]$MaxRetries = 1,        # số lần cho agent sửa khi kiểm tra báo LOI
  [switch]$NoCheckpoint,
  [switch]$DryRun,
  [switch]$Resume              # giữ thay đổi chưa commit của giai đoạn -From: bỏ bước agent làm lần đầu, chạy test + kiểm tra luôn
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$Spec = 'prompts/ke-hoach-thoi-tiet.md'
$LogDir = 'tests/screens/weather-logs'
$Baseline = 'tests/screens/chuan-truoc-weather.txt'
$Branch = 'feature/weather'
$Trailer = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

# ============================ Bảng giai đoạn ============================
# sec: mục đặc tả agent cần đọc · tests: script npm chạy sau khi agent làm · testsFirst: chạy test trước agent (GĐ8 ghi kết quả vào tài liệu)
$Phases = @(
  @{ n = 1; title = 'khung trạng thái + config';         model = 'sonnet'; effort = 'medium'; sec = '3, 5, 10 (Giai đoạn 1)';            tests = @('test:drawcalls') },
  @{ n = 2; title = 'khí quyển 4 preset + UI';           model = 'sonnet'; effort = 'medium'; sec = '4.1, 4.2, 8.1, 9, 10 (Giai đoạn 2)'; tests = @('test:drawcalls') },
  @{ n = 3; title = 'mưa + mặt ướt';                     model = 'opus';   effort = 'high';   sec = '4.3, 4.4, 5.3, 9, 10 (Giai đoạn 3)'; tests = @('test:drawcalls', 'test:tunnel'); checkpoint = $true },
  @{ n = 4; title = 'gió: cây, sóng, rung cáp';          model = 'opus';   effort = 'high';   sec = '2.2, 2.3, 4.5, 9, 10 (Giai đoạn 4)'; tests = @('test:drawcalls', 'test:tour') },
  @{ n = 5; title = 'bão: chớp, đóng cầu, cầu quay';     model = 'sonnet'; effort = 'medium'; sec = '2, 4.6, 5.3, 10 (Giai đoạn 5), 11';  tests = @('test:drawcalls', 'test:weather'); checkpoint = $true },
  @{ n = 6; title = 'bảng ảnh hưởng + góc nhìn + i18n';  model = 'sonnet'; effort = 'medium'; sec = '8, 10 (Giai đoạn 6)';                tests = @('test:drawcalls', 'test:weather') },
  @{ n = 7; title = 'kịch bản bão + nắng hè + âm thanh'; model = 'sonnet'; effort = 'medium'; sec = '4.7, 4.8, 6, 7, 10 (Giai đoạn 7)';  tests = @('test:weather', 'test:tour') },
  @{ n = 8; title = 'hoàn tất: test đủ bộ + tài liệu';   model = 'haiku';  effort = 'low';    sec = '10 (Giai đoạn 8), 11, 13';          tests = @('test:drawcalls', 'test:tour', 'test:tunnel', 'test:riverfront', 'test:voice', 'test:weather'); testsFirst = $true }
)
$VerifyModel = 'sonnet'; $VerifyEffort = 'medium'

# Quyền: agent làm được sửa file (acceptEdits) + các lệnh dưới; mọi thứ khác bị từ chối (--permission-prompts none), không treo chờ hỏi
$WorkTools = @('Bash(npm run build)', 'Bash(npm run typecheck)', 'Bash(node *)', 'Bash(git diff*)', 'Bash(git status*)', 'Bash(git log*)')
$VerifyTools = @('Bash(git diff*)', 'Bash(git status*)', 'Bash(git log*)')
$SystemNote = 'Chạy lệnh bằng công cụ Bash (không dùng PowerShell). Không chạy git commit, git push, git checkout, git stash. Không hỏi lại người dùng: không ai trả lời; thiếu thông tin thì chọn phương án an toàn nhất trong đặc tả và ghi rõ trong báo cáo.'

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
if (-not (Select-String -Path $Spec -Pattern '^## 12b' -Quiet)) {
  Stop-Run "chưa có mục '## 12b' (câu trả lời 7 câu hỏi ở mục 12) cuối $Spec. Agent sẽ phải tự đoán ở GĐ5, GĐ7."
}
$cur = (git branch --show-current).Trim()
if ($cur -ne $Branch) { Stop-Run "đang ở nhánh '$cur', cần '$Branch' (git checkout -b $Branch)" }
if (-not $Resume -and (git status --porcelain)) { Stop-Run 'cây làm việc chưa sạch: commit hoặc bỏ thay đổi trước khi chạy (hoặc dùng -Resume để chấm lại phần việc đang có của giai đoạn -From)' }
New-Item -ItemType Directory -Force $LogDir | Out-Null

# Chuẩn draw call đo trên code CHƯA có thời tiết: chỉ đo khi bắt đầu từ GĐ1, cây sạch và chưa có file hợp lệ
# Hợp lệ = có bảng console.table của tests/drawcalls.mjs (dòng 'overview|ngày'); file lỗi (thiếu Chromium…) thì xoá, không dùng
$baselineOk = (Test-Path $Baseline) -and (Select-String -Path $Baseline -Pattern 'overview\|' -Quiet)
if (-not $baselineOk -and -not $DryRun) {
  if (Test-Path $Baseline) { Remove-Item $Baseline; Say "Đã xoá $Baseline vì không có bảng draw call (lần đo trước lỗi)" 'Yellow' }
  if ($From -gt 1 -or $Resume) { Stop-Run "thiếu chuẩn draw call hợp lệ ($Baseline); phải đo trên code CHƯA có thời tiết (cây sạch, -From 1, không -Resume)" }
  Say '== Đo chuẩn draw call trước khi sửa (10–20 phút) =='
  if (-not (Invoke-Npm 'build' "$LogDir/chuan-build.log")) { Stop-Run 'build lỗi trên code gốc' }
  if (-not (Invoke-Npm 'test:drawcalls' $Baseline)) {
    Copy-Item $Baseline "$LogDir/chuan-loi.log" -Force; Remove-Item $Baseline
    Stop-Run "test:drawcalls lỗi trên code gốc, xem $LogDir/chuan-loi.log (thiếu Chromium thì chạy: npx playwright install chromium)"
  }
}

# ============================ Chạy từng giai đoạn ============================
$summary = @(); $totalCost = 0.0
foreach ($p in $Phases | Where-Object { $_.n -ge $From -and $_.n -le $To }) {
  $n = $p.n; $start = (git rev-parse HEAD).Trim()
  Say "`n== Giai đoạn ${n}: $($p.title) ($($p.model), effort $($p.effort)) ==" 'Yellow'

  $work = @"
Đọc .github/copilot-instructions.md, .github/memory-bank/activeContext.md, rồi đọc $Spec mục $($p.sec) và mục 12b (câu trả lời của người dùng cho mục 12).
Chỉ làm Giai đoạn $n. Không làm việc của giai đoạn sau.
Sau khi sửa: chạy npm run build và sửa tới khi qua. KHÔNG chạy npm run test:drawcalls, test:tour, test:tunnel, test:riverfront, test:voice, test:weather: script bên ngoài sẽ chạy và chấm.
Khi giai đoạn có bước tự xem bằng mắt: viết script Node + Playwright (dùng tests/lib.mjs) chụp ảnh vào tests/screens/weather-gd$n/, rồi mở từng ảnh bằng công cụ Read và soát theo đặc tả.
Cập nhật .github/memory-bank/activeContext.md: đã làm gì ở Giai đoạn $n, còn gì dở, bước tiếp theo.
Báo cáo ngắn: file đã sửa, quyết định đã chọn, việc chưa làm được. Dòng cuối cùng in đúng một trong hai: KET_QUA: DAT hoặc KET_QUA: LOI kèm lý do.
"@
  if ($p.testsFirst) {
    $work = $work -replace 'KHÔNG chạy npm run test:[^\r\n]*', "Không chạy test: script đã chạy đủ bộ, log ở $LogDir/gd$n-l0-*.log. Dùng các log đó để cập nhật tests/KET-QUA.md (bảng draw call mới gồm hr*, rf*, wx* và các preset thời tiết), README mục Cấu trúc, .github/memory-bank/progress.md và systemPatterns.md."
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
Chuẩn draw call trước khi có thời tiết: $Baseline. Log của lần chạy này: $($tr.logs -join ', ') (script ghi nhận: $($tr.note)).
Chạy git status và git diff $start để xem thay đổi của giai đoạn.
Chấm theo điều kiện kiểm tra của Giai đoạn ${n}: draw call so với chuẩn (đúng ngưỡng ở mục 9), test qua, không lỗi console, không đụng chuỗi rand() trong code cũ, đủ 9 ngôn ngữ nếu có khóa mới, không làm việc của giai đoạn khác.
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
    git commit -q -m "feat(weather): giai đoạn $n — $($p.title)" -m $Trailer
    if ($LASTEXITCODE -ne 0) { Stop-Run "git commit lỗi ở giai đoạn $n" }
    Say "    Đã commit: $((git log -1 --format='%h %s').Trim())" 'Green'
  }

  if ($p.checkpoint -and -not $NoCheckpoint -and $n -lt $To) {
    Say "`n-- Điểm dừng sau Giai đoạn ${n}: tự xem trước khi đi tiếp --" 'Magenta'
    Say "   npm run dev → mở http://localhost:5173/?test, đổi qua các chế độ thời tiết, ngày/đêm"
    Say "   Ảnh agent đã chụp: tests/screens/weather-gd$n/   ·   Thay đổi: git show --stat HEAD"
    $ans = Read-Host '   Gõ c để chạy tiếp, phím khác để dừng'
    if ($ans -ne 'c') { $summary | Format-Table -AutoSize; Say "Đã dừng. Chạy tiếp bằng: -From $($n + 1)" 'Magenta'; exit 0 }
  }
}

$summary | Format-Table -AutoSize
Say ("Tổng chi phí ước tính: {0:N2} USD. Log: $LogDir" -f $totalCost) 'Green'
Say "Xong. Bước tiếp theo (tay): review (/code-review high) rồi push + tạo PR." 'Green'
