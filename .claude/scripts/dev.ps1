# Terminal de desenvolvimento: mostra o que vai rodar e RODA. PowerShell.
# Chamado pelas tasks de .vscode/tasks.json (abrem sozinhas ao abrir a pasta do workspace).
#
#   .\.claude\scripts\dev.ps1 infra|claude|pago|free|api|front [-Pasta <relativa ao workspace>] [-Comando "<comando>"] [-Projeto <nome na infra>]
#
# -Projeto: nome do projeto em ai-infra\configs\infra\projects.json (o `verify` confere só a casa dele).
# Sem ele: nome da pasta do workspace sem o sufixo "-workspace" (esteira -> esteira; valuto-workspace -> valuto).
#
# -Pasta/-Comando existem para layout que foge do padrão (só front, só API, monorepo): o agent da Etapa 2
# (ai-ops) pergunta, confirma e grava esses valores na task. Sem eles: acha sozinho `*-api` e `*-frontend`.
param(
  [Parameter(Mandatory)][ValidateSet('infra', 'claude', 'pago', 'free', 'api', 'front')][string]$Qual,
  [string]$Pasta,
  [string]$Comando,
  [string]$Projeto
)
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Achar($filtro) {
  $d = Get-ChildItem -Path $raiz -Directory -Filter $filtro | Select-Object -First 1
  if (-not $d) { Write-Host "Nenhuma pasta '$filtro' em $raiz" -ForegroundColor Red; return $null }
  return $d.FullName
}

function PortaAberta([int]$porta) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $ok = $c.ConnectAsync('127.0.0.1', $porta).Wait(800)
    $c.Close()
    return $ok
  } catch { return $false }
}

function EsperarPorta([int]$porta, [string]$nome, [int]$segundos = 300) {
  if (PortaAberta $porta) { return $true }
  Write-Host "Aguardando $nome (porta $porta), até $segundos s..." -ForegroundColor DarkGray
  $fim = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $fim) {
    if (PortaAberta $porta) { Write-Host "$nome no ar." -ForegroundColor Green; return $true }
    Start-Sleep -Seconds 3
  }
  Write-Host "$nome não respondeu em $segundos s. Suba a infra (terminal Infra) e rode de novo." -ForegroundColor Red
  return $false
}

function AcharInfra {
  $d = $raiz
  for ($i = 0; $i -lt 5; $i++) {
    $alvo = Join-Path $d 'ai-infra\configs\infra\infra-config.mjs'
    if (Test-Path $alvo) { return (Split-Path $alvo) }
    $pai = Split-Path $d
    if (-not $pai -or $pai -eq $d) { break }
    $d = $pai
  }
  return $null
}

# Infra: só sobe o que não está no ar. Docker fora -> espera; tudo saudável -> só confere (verify, somente leitura).
function Infra($dirInfra) {
  $nomeProjeto = if ($Projeto) { $Projeto } else { (Split-Path $raiz -Leaf) -replace '-workspace$', '' }
  $tentativas = 0
  while ($true) {
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    if ($tentativas -eq 0) { Write-Host 'Docker Desktop não está respondendo. Abra o Docker Desktop; esperando até 3 min...' -ForegroundColor Yellow }
    $tentativas++
    if ($tentativas -gt 36) { Write-Host 'Docker não respondeu. Abra o Docker Desktop e rode este terminal de novo.' -ForegroundColor Red; return }
    Start-Sleep -Seconds 5
  }
  $container = Join-Path (Split-Path (Split-Path $dirInfra)) 'container'
  $esperados = @(docker compose -f (Join-Path $container 'docker-compose.yml') --env-file (Join-Path $container '.env') config --services 2>$null).Count
  $linhas = @(docker ps --filter 'label=com.docker.compose.project=infra' --format '{{.Names}}|{{.Status}}' 2>$null)
  $saudaveis = @($linhas | Where-Object { $_ -match '\|Up' -and $_ -notmatch 'unhealthy|health: starting' }).Count
  Set-Location $dirInfra
  if ($esperados -gt 0 -and $saudaveis -ge $esperados) {
    Write-Host "Infra já está no ar ($saudaveis/$esperados serviços saudáveis). Só conferindo o projeto '$nomeProjeto': node infra-config.mjs verify --projeto=$nomeProjeto" -ForegroundColor Green
    node infra-config.mjs verify "--projeto=$nomeProjeto"
  } else {
    Write-Host "Infra incompleta ($saudaveis/$esperados serviços saudáveis). Subindo: node infra-config.mjs up" -ForegroundColor Yellow
    node infra-config.mjs up
  }
}

switch ($Qual) {
  'infra' {
    $dirInfra = AcharInfra
    if (-not $dirInfra) { Write-Host 'ai-infra\configs\infra não encontrado acima desta pasta (5 níveis).' -ForegroundColor Red; return }
    Write-Host ''; Write-Host '== Infra ==' -ForegroundColor Cyan
    Write-Host "Pasta: $dirInfra"
    Infra $dirInfra
    return
  }
  'claude' { $titulo = 'Claude (plano)';          $dir = $raiz; $cmd = 'claude' }
  'pago'   { $titulo = 'Claude pago (OmniRoute)'; $dir = $raiz; $cmd = 'claude-pago' }
  'free'   { $titulo = 'Claude free (OmniRoute)'; $dir = $raiz; $cmd = 'claude-free' }
  'api' {
    $titulo = 'API'; $dir = if ($Pasta) { Join-Path $raiz $Pasta } else { Achar '*-api' }
    $proj = if ($dir) { Get-ChildItem -Path (Join-Path $dir 'src') -Directory -Filter '*.Api' -ErrorAction SilentlyContinue | Select-Object -First 1 }
    $cmd = if ($proj) { "dotnet run --project src\$($proj.Name) --launch-profile http" } else { 'dotnet run --launch-profile http' }
  }
  'front'  { $titulo = 'Frontend'; $dir = if ($Pasta) { Join-Path $raiz $Pasta } else { Achar '*-frontend' }; $cmd = 'npm start' }
}
if ($Comando) { $cmd = $Comando }

if (-not $dir -or -not (Test-Path $dir)) { Write-Host "Pasta não encontrada: $dir" -ForegroundColor Red; return }
Write-Host ''; Write-Host "== $titulo ==" -ForegroundColor Cyan
Write-Host "Pasta:   $dir"
Write-Host "Comando: $cmd" -ForegroundColor Yellow

# Espera o que o comando precisa (não sobe a infra sozinho: quem sobe é o terminal Infra)
if ($Qual -in 'pago', 'free') { if (-not (EsperarPorta 20128 'OmniRoute')) { return } }
if ($Qual -eq 'api') { if (-not (EsperarPorta 5432 'Postgres')) { return } }

Set-Location $dir
Invoke-Expression $cmd
