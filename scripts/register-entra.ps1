# IDSignal - administrator-run bootstrap. Download a fresh copy from setup.
# Requires Azure CLI (az). Creates ONE single-tenant app, a service principal,
# and a one-year client secret. Grants no consent automatically.
$ErrorActionPreference = 'Stop'
$tenantId = '__TENANT__'
$appOrigin = '__ORIGIN__'
$bootstrapToken = '__TOKEN__'
if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Azure CLI gerekli: https://learn.microsoft.com/cli/azure/install-azure-cli-windows' }
Write-Host 'IDSignal uygulama kaydi olusturulacak. Microsoft yonetici oturumunuzu tamamlayin.'
az login --tenant $tenantId --allow-no-subscriptions --output none
if ($LASTEXITCODE -ne 0) { throw 'Microsoft oturumu acilamadi.' }
$graph = az ad sp show --id 00000003-0000-0000-c000-000000000000 --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Graph izin listesi alinamadi.' }
$roles = @()
foreach ($permission in @('AuditLog.Read.All', 'User.Read.All', 'UserAuthenticationMethod.Read.All')) {
    $role = $graph.appRoles | Where-Object { $_.value -eq $permission -and $_.allowedMemberTypes -contains 'Application' }
    if (-not $role) { throw "Izin bulunamadi: $permission" }
    $roles += @{ id = $role.id; type = 'Role' }
}
$manifestPath = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
$manifest = ConvertTo-Json -InputObject @(@{ resourceAppId = '00000003-0000-0000-c000-000000000000'; resourceAccess = $roles }) -Depth 8
[System.IO.File]::WriteAllText($manifestPath, $manifest)
try {
    $app = az ad app create --display-name 'IDSignal Local' --sign-in-audience AzureADMyOrg --web-redirect-uris "$appOrigin/auth/callback" --required-resource-accesses "@$manifestPath" --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Uygulama kaydi olusturulamadi.' }
    Write-Host "Olusturulan Client ID: $($app.appId)"
    az ad sp create --id $app.appId --output none
    if ($LASTEXITCODE -ne 0) { throw 'Kurumsal uygulama olusturulamadi. Portalda uygulama kaydini kontrol edin.' }
    $credential = az ad app credential reset --id $app.appId --append --display-name 'IDSignal local collector' --years 1 --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Uygulama sirri olusturulamadi.' }
    $payload = @{ tenantId = $tenantId; clientId = $app.appId; secret = $credential.password } | ConvertTo-Json
    Invoke-RestMethod -Uri "$appOrigin/api/bootstrap-import" -Method Post -ContentType 'application/json' -Headers @{ Authorization = "Bearer $bootstrapToken" } -Body $payload | Out-Null
    Write-Host 'Kayit tamamlandi. IDSignal ekranina donun ve Entra yonetici onayini verin. Secret bir yil sonra yenilenmelidir.'
} catch {
    Write-Host 'Kurulum tamamlanamadi. Olusturulmus uygulama varsa yeniden betik calistirmadan once Entra portalindan inceleyin. Secret degeri ekrana yazdirilmaz; gerekirse portalda yeni secret olusturup manuel baglanti kullanin.'
    throw
} finally {
    $credential = $null; $payload = $null; $bootstrapToken = $null
    Remove-Item -LiteralPath $manifestPath -ErrorAction SilentlyContinue
}
