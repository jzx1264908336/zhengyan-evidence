@echo off
cd /d "%~dp0"
echo Starting local research desk with Ollama. No cloud API key is used.
echo Open http://127.0.0.1:5173/ after the server starts.
node scripts\run-local-model.mjs dev
pause
