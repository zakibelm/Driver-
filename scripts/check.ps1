param([Parameter(Mandatory=$true)][int]$Chantier)
$ErrorActionPreference = 'Stop'
& npm.cmd run build 2>&1 | Tee-Object -FilePath "audit/chantier-$Chantier-build.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd test 2>&1 | Tee-Object -FilePath "audit/chantier-$Chantier-test.txt"
exit $LASTEXITCODE
