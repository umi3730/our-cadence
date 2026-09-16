$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseDirectory = Join-Path $projectRoot 'releases'
Push-Location $projectRoot
try {
    # Ask Git for the exact shareable set without modifying the index.
    $paths = @(& git -c core.quotepath=false ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'Initialize the repository with git init before packaging.' }
    $paths = @($paths | Sort-Object -Unique)
    if ($paths.Count -eq 0) { throw 'No source files found.' }
    $unsafe = @($paths | Where-Object {
        $_ -match '(^|/)(\.git|node_modules|dist|\.next|\.sites-runtime|\.wrangler|releases)/' -or
        $_ -match '(^|/)(\.env(?!\.example$)|\.dev\.vars)' -or
        $_ -match '\.(pem|key|p12|pfx)$'
    })
    if ($unsafe.Count -gt 0) { throw 'Sensitive or generated files are tracked. Review the Git index before packaging.' }
    [IO.Directory]::CreateDirectory($releaseDirectory) | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $base = Join-Path $releaseDirectory "our-cadence-source-$stamp"
    $zipPath = "$base.zip"
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($relative in $paths) {
            $absolute = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
            if (-not $absolute.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
                throw 'Source path escaped the project root.'
            }
            if (-not [IO.File]::Exists($absolute)) { throw "Source file is missing: $relative" }
            if ((Get-Item -LiteralPath $absolute).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Review symbolic link before packaging: $relative"
            }
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $absolute, ('our-cadence/' + $relative.Replace('\', '/')),
                [IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    } finally { $archive.Dispose() }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllLines("$base.files.txt", [string[]]$paths, $utf8)
    $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$base.sha256", "$hash  $([IO.Path]::GetFileName($zipPath))`n", $utf8)
    Write-Output "ZIP: $zipPath"
    Write-Output "Files: $($paths.Count)"
    Write-Output "SHA256: $hash"
} finally { Pop-Location }
