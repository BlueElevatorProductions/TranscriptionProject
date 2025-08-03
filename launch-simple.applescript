tell application "Terminal"
    activate
    do script "cd ~/Documents/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject && npm run clean:dev && sleep 1 && npm run start-dev"
end tell