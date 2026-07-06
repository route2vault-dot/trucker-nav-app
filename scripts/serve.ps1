# STN local test server — serves the app/ folder at http://localhost:8080
# Run from anywhere:  powershell -File scripts\serve.ps1   (Ctrl+C to stop)
# Needed because browsers block map-data loading from plain file:// pages.

$root = Join-Path (Split-Path $PSScriptRoot -Parent) 'app'
$port = 8080

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'text/javascript'
  '.json' = 'application/json'
  '.geojson' = 'application/geo+json'
  '.webmanifest' = 'application/manifest+json'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "STN running at http://localhost:$port  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $rel = [uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($rel -eq '') { $rel = 'index.html' }
    $path = Join-Path $root $rel
    # keep requests inside the app folder
    $full = [IO.Path]::GetFullPath($path)
    if ((Test-Path $full -PathType Leaf) -and $full.StartsWith([IO.Path]::GetFullPath($root))) {
      $bytes = [IO.File]::ReadAllBytes($full)
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $listener.Stop()
}
