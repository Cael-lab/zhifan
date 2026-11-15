param(
    [switch]$Rebuild,
    [ValidateRange(1, 65535)][int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:NEXT_TELEMETRY_DISABLED = '1'

function Invoke-JournalPnpm {
    param([string[]]$CommandArgs)
    & npx.cmd --yes --package node@22.16.0 --package pnpm@11.0.8 pnpm @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "pnpm command failed ($LASTEXITCODE)." }
}

try {
    if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
        throw 'Node.js and npm are required. Install Node.js, then run this file again.'
    }
    if (-not (Test-Path -LiteralPath 'node_modules/.pnpm')) {
        Invoke-JournalPnpm -CommandArgs @('install', '--frozen-lockfile')
    }
    if ($Rebuild -or -not (Test-Path -LiteralPath 'apps/web/.next/BUILD_ID')) {
        Invoke-JournalPnpm -CommandArgs @('-r', '--filter', './packages/*', 'build')
        Invoke-JournalPnpm -CommandArgs @('build')
    }
    Write-Host "Open http://127.0.0.1:$Port in your browser. Keep this window open; Ctrl+C stops the app."
    Invoke-JournalPnpm -CommandArgs @('--filter', 'web', 'start', '--hostname', '127.0.0.1', '--port', "$Port")
} catch {
    Write-Host $_ -ForegroundColor Red
    exit 1
}
