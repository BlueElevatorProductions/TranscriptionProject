tell application "Terminal"
    activate
    
    -- Kill any existing processes first
    do script "cd ~/Documents/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject && npm run clean:dev && pkill -f electron || true"
    
    -- Wait for cleanup
    delay 1
    
    -- Use the combined start-dev command in a single window
    do script "cd ~/Documents/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject && npm run start-dev" in window 1
    
end tell