param(
    [string]$RobloxVersionsPath = (Join-Path $env:LOCALAPPDATA "Roblox\Versions"),
    [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json")
)

$ErrorActionPreference = "Stop"

function Set-ConfigProperty {
    param(
        [System.Management.Automation.PSObject]$Object,
        [string]$Name,
        [object]$Value
    )

    if ($Object.PSObject.Properties[$Name]) {
        $Object.$Name = $Value
    }
    else {
        $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
    }
}

function Find-WorkingPython {
    $candidates = @()
    foreach ($name in @("python", "python3", "py")) {
        $cmds = Get-Command $name -All -ErrorAction SilentlyContinue
        foreach ($cmd in $cmds) {
            if ($cmd.Source -and $cmd.Source -notlike "*\Microsoft\WindowsApps\*") {
                $candidates += $cmd.Source
            }
        }
    }
    if ($env:LOCALAPPDATA) {
        $localPy = Join-Path $env:LOCALAPPDATA "Python\bin\python.exe"
        if (Test-Path -LiteralPath $localPy -PathType Leaf) {
            $candidates += $localPy
        }
    }
    foreach ($exe in ($candidates | Select-Object -Unique)) {
        try {
            $null = & $exe --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                return $exe
            }
        }
        catch {}
    }
    return $null
}

$vscodeMcpExe = Join-Path $PSScriptRoot "vscode_mcp.exe"
$vscodeMcpPy = Join-Path $PSScriptRoot "vscode_mcp.py"
$vscodeMcpCommand = $null
$vscodeMcpArgs = @()

$hasExe = Test-Path -LiteralPath $vscodeMcpExe -PathType Leaf
$hasPy = Test-Path -LiteralPath $vscodeMcpPy -PathType Leaf
$pyExe = if ($hasPy) { Find-WorkingPython } else { $null }
$pyIsNewer = $hasExe -and $hasPy -and ((Get-Item -LiteralPath $vscodeMcpPy).LastWriteTimeUtc -gt (Get-Item -LiteralPath $vscodeMcpExe).LastWriteTimeUtc)

if ($hasPy -and $pyExe -and (-not $hasExe -or $pyIsNewer)) {
    $vscodeMcpCommand = $pyExe
    $vscodeMcpArgs = @($vscodeMcpPy)
}
elseif ($hasExe) {
    $vscodeMcpCommand = $vscodeMcpExe
}
elseif ($hasPy) {
    throw "Python 3.9+ was not found to run '$vscodeMcpPy'."
}
else {
    throw "VS Code MCP was not found at '$vscodeMcpExe'. Extract the whole release, then run start.bat again."
}

$studioMcp = Get-ChildItem -Path (Join-Path $RobloxVersionsPath "version-*\StudioMCP.exe") -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (Test-Path -LiteralPath $ConfigPath) {
    try {
        $configuration = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    }
    catch {
        throw "Could not read '$ConfigPath' as JSON. Fix or remove this local configuration, then run start.bat again. $($_.Exception.Message)"
    }

    if (-not $configuration -or $configuration -isnot [System.Management.Automation.PSCustomObject]) {
        throw "'$ConfigPath' must contain a JSON object."
    }

    if (-not $configuration.PSObject.Properties["mcpServers"]) {
        $configuration | Add-Member -MemberType NoteProperty -Name mcpServers -Value ([pscustomobject]@{})
    }

    if ($configuration.mcpServers -isnot [System.Management.Automation.PSCustomObject]) {
        throw "'$ConfigPath' must contain an object named 'mcpServers'."
    }
}
else {
    $configuration = [pscustomobject]@{
        mcpServers = [pscustomobject]@{}
    }
}

$vscodeServer = $configuration.mcpServers.vscode
if (-not $vscodeServer) {
    $vscodeServer = [pscustomobject]@{}
    $configuration.mcpServers | Add-Member -MemberType NoteProperty -Name vscode -Value $vscodeServer
}

if ($vscodeServer -isnot [System.Management.Automation.PSCustomObject]) {
    throw "'$ConfigPath' must contain an object named 'mcpServers.vscode'."
}

$configuredCommand = $vscodeServer.command
$usesBundledVscode = [string]::IsNullOrWhiteSpace($configuredCommand) -or
    [System.IO.Path]::GetFileName($configuredCommand) -ieq "vscode_mcp.exe" -or
    ($vscodeServer.args -and ($vscodeServer.args | Where-Object { [System.IO.Path]::GetFileName($_) -ieq "vscode_mcp.py" }))
if ($usesBundledVscode) {
    Set-ConfigProperty -Object $vscodeServer -Name "command" -Value $vscodeMcpCommand
    Set-ConfigProperty -Object $vscodeServer -Name "args" -Value $vscodeMcpArgs
    if ($vscodeServer.PSObject.Properties["env"]) {
        if ($vscodeServer.env -isnot [System.Management.Automation.PSCustomObject]) {
            throw "'$ConfigPath' must contain an object named 'mcpServers.vscode.env'."
        }
    }
    else {
        Set-ConfigProperty -Object $vscodeServer -Name "env" -Value ([pscustomobject]@{})
    }
    if ($vscodeServer.env.PSObject.Properties["VSCODE_WORKSPACE_PATH"]) {
        $vscodeServer.env.PSObject.Properties.Remove("VSCODE_WORKSPACE_PATH")
    }
}

if ($studioMcp) {
    $robloxServer = [pscustomobject]@{
        command = $studioMcp.FullName
        args = @("--stdio")
    }

    if ($configuration.mcpServers.PSObject.Properties["roblox"]) {
        $configuration.mcpServers.roblox = $robloxServer
    }
    else {
        $configuration.mcpServers | Add-Member -MemberType NoteProperty -Name roblox -Value $robloxServer
    }
}
elseif ($configuration.mcpServers.PSObject.Properties["roblox"] -and
    [System.IO.Path]::GetFileName($configuration.mcpServers.roblox.command) -ieq "StudioMCP.exe") {
    $configuration.mcpServers.PSObject.Properties.Remove("roblox")
}

$json = ConvertTo-Json -InputObject $configuration -Depth 20
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ConfigPath, "$json`n", $utf8WithoutBom)

Write-Host "VS Code MCP detected: $vscodeMcpCommand"
Write-Host "Open a project in VS Code before starting the agent from the chat bar."
if ($studioMcp) {
    Write-Host "Roblox Studio MCP detected: $($studioMcp.FullName)"
}
else {
    Write-Host "Roblox Studio MCP not found; VS Code remains available."
}

# Optional: Auto-configure Claude Desktop if installed (%APPDATA%\Claude)
if ($env:APPDATA) {
    $claudeDir = Join-Path $env:APPDATA "Claude"
    if (Test-Path -LiteralPath $claudeDir -PathType Container) {
        $claudeConfigPath = Join-Path $claudeDir "claude_desktop_config.json"
        try {
            $claudeCfg = if (Test-Path -LiteralPath $claudeConfigPath -PathType Leaf) {
                Get-Content -LiteralPath $claudeConfigPath -Raw | ConvertFrom-Json
            } else {
                [pscustomobject]@{ mcpServers = [pscustomobject]@{} }
            }
            if (-not $claudeCfg.PSObject.Properties["mcpServers"]) {
                $claudeCfg | Add-Member -MemberType NoteProperty -Name mcpServers -Value ([pscustomobject]@{})
            }
            Set-ConfigProperty -Object $claudeCfg.mcpServers -Name "snapgent-vscode" -Value ([pscustomobject]@{
                command = $vscodeMcpCommand
                args = $vscodeMcpArgs
            })
            if ($studioMcp) {
                Set-ConfigProperty -Object $claudeCfg.mcpServers -Name "snapgent-roblox" -Value ([pscustomobject]@{
                    command = $studioMcp.FullName
                    args = @("--stdio")
                })
            }
            $claudeJson = ConvertTo-Json -InputObject $claudeCfg -Depth 20
            [System.IO.File]::WriteAllText($claudeConfigPath, "$claudeJson`n", $utf8WithoutBom)
            Write-Host "Claude Desktop MCP configured: $claudeConfigPath"
        }
        catch {
            Write-Host "Note: Could not update Claude Desktop config ($($_.Exception.Message))"
        }
    }
}
