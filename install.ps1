# install.ps1 - install the desktop-background plugin into a DSH profile.
#
#   .\install.ps1 -ProfileDir "$env:DSH_HOME\profiles\desktop" `
#                 -LightImage D:\pictures\light.jpg -DarkImage D:\pictures\dark.jpg
#   (dry run by default; add -Apply to write)
#
# What it does:
#   1. copy index.js + client-script.js into <ProfileDir>\desktop-background\
#   2. back up <ProfileDir>\cordis.patch.yml as cordis.patch.yml.bak_<timestamp>
#   3. append the insert block (idempotent: skips if the id is already present)
#
# It does NOT restart DSH - profile patches are read once per process start.
param(
    [string]$ProfileDir = (Join-Path $(if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }) 'profiles\desktop'),
    [Parameter(Mandatory = $true)][string]$LightImage,
    [Parameter(Mandatory = $true)][string]$DarkImage,
    [double]$MaskOpacity = 0.30,
    [double]$SurfaceOpacity = 0.08,
    # Region knobs. Use -1 (the default) to omit them and inherit SurfaceOpacity.
    [double]$InputOpacity = -1,
    [double]$TodoOpacity = -1,
    [double]$OptionOpacity = -1,
    [ValidateSet('precise', 'broad')][string]$TodoScope = 'precise',
    [ValidateSet('precise', 'broad')][string]$OptionScope = 'precise',
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$Src = $PSScriptRoot

function Say($m) { Write-Host $m }

Say "== desktop-background installer =="
Say "profile   : $ProfileDir"
Say "light     : $LightImage"
Say "dark      : $DarkImage"
Say "mask      : $MaskOpacity"
Say "surface   : $SurfaceOpacity"
Say "input     : $(if ($InputOpacity -ge 0) { $InputOpacity } else { '(inherit surface)' })"
Say "todo      : $(if ($TodoOpacity -ge 0) { $TodoOpacity } else { '(inherit surface)' }) scope=$TodoScope"
Say "option    : $(if ($OptionOpacity -ge 0) { $OptionOpacity } else { '(inherit surface)' }) scope=$OptionScope"
Say "mode      : $(if ($Apply) { 'APPLY (will write)' } else { 'dry-run' })"
Say ""

foreach ($img in @($LightImage, $DarkImage)) {
    if (-not (Test-Path -LiteralPath $img -PathType Leaf)) {
        throw "background image not found: $img"
    }
}
if (-not (Test-Path -LiteralPath $ProfileDir -PathType Container)) {
    throw "profile directory not found: $ProfileDir"
}

$pluginDst = Join-Path $ProfileDir "desktop-background"
$patch = Join-Path $ProfileDir "cordis.patch.yml"

# --- 1. plugin files ---------------------------------------------------------
$files = @("index.js", "client-script.js")
Say "1) plugin files"
foreach ($f in $files) {
    $from = Join-Path $Src $f
    if (-not (Test-Path -LiteralPath $from)) { throw "missing source file: $from" }
    Say "   $from -> $(Join-Path $pluginDst $f)"
}
if ($Apply) {
    New-Item -ItemType Directory -Force -Path $pluginDst | Out-Null
    foreach ($f in $files) { Copy-Item (Join-Path $Src $f) (Join-Path $pluginDst $f) -Force }
    Say "   copied."
}

# --- 2. patch file -----------------------------------------------------------
Say "2) cordis.patch.yml"
if (-not (Test-Path -LiteralPath $patch)) { throw "patch file not found: $patch" }
$existing = Get-Content -LiteralPath $patch -Raw -Encoding UTF8
if ($existing -match 'id:\s*desktop-background') {
    Say "   already contains 'id: desktop-background' -> nothing to append."
    Say "   (edit the existing block to change images or opacities)"
} else {
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backup = "$patch.bak_$stamp"
    Say "   backup -> $backup"
    $region = ""
    if ($InputOpacity -ge 0) { $region += "        inputOpacity: $InputOpacity`n" }
    if ($TodoOpacity -ge 0) { $region += "        todoOpacity: $TodoOpacity`n" }
    if ($OptionOpacity -ge 0) { $region += "        optionOpacity: $OptionOpacity`n" }
    if ($TodoScope -ne 'precise') { $region += "        todoScope: '$TodoScope'`n" }
    if ($OptionScope -ne 'precise') { $region += "        optionScope: '$OptionScope'`n" }

    $block = @"

# desktop-background: injected by install.ps1
- insert:
    - id: desktop-background
      name: './desktop-background/index.js'
      config:
        lightImage: '$($LightImage -replace '\\','/')'
        darkImage: '$($DarkImage -replace '\\','/')'
        maskOpacity: $MaskOpacity
        surfaceOpacity: $SurfaceOpacity
$($region.TrimEnd("`n"))
"@
    if ($Apply) {
        Copy-Item -LiteralPath $patch -Destination $backup -Force
        Add-Content -LiteralPath $patch -Value $block -Encoding UTF8
        Say "   appended."
    } else {
        Say "   [dry-run] would append:"
        $block -split "`n" | ForEach-Object { Say "      $_" }
    }
}

Say ""
Say "3) restart DSH (profile patches are read once per process start), then hard-refresh."
Say "   verify: the background event log should show bg-ready (rowCount: 2) and"
Say "           bg-inject (kinds: style+script); a round button appears bottom-right."
