$ErrorActionPreference = 'Stop';

$url = 'https://github.com/localpass/clients/releases/download/desktop-v__version__/__artifact_prefix__LocalPass-Installer-__version__.exe'
$checksum = '__checksum__'

$packageArgs = @{
  packageName   = 'localpass'
  fileType      = 'EXE'
  softwareName  = 'LocalPass'
  url           = $url
  checksum      = $checksum
  checksumType  = 'sha256'
  silentArgs    = '/S'
  validExitCodes= @(0)
}

Install-ChocolateyPackage @packageArgs
