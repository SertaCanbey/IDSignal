$ErrorActionPreference = 'Stop'
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$az = Get-Command az.cmd -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
if (-not $az) {
    foreach ($candidate in @("${env:ProgramFiles}\Microsoft SDKs\Azure\CLI2\wbin\az.cmd", "${env:ProgramFiles(x86)}\Microsoft SDKs\Azure\CLI2\wbin\az.cmd")) {
        if (Test-Path -LiteralPath $candidate) { $az = $candidate; break }
    }
}
if (-not $az) { [Console]::Error.WriteLine('IR_CLI_MISSING'); exit 127 }
& $az @($request.args)
exit $LASTEXITCODE
