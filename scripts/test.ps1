$ErrorActionPreference = 'Stop'

Write-Host 'Running Python tests...'
pytest

Write-Host 'Running frontend tests...'
Push-Location frontend
npm test
Pop-Location
