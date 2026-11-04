@echo off
echo This downloads Qwen3.5 9B, several GB. No API key or cloud credits needed.
echo Model tags can change. See models\model-lock.json for the tested version.
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
  "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3.5:9b
) else (
  ollama pull qwen3.5:9b
)
pause
