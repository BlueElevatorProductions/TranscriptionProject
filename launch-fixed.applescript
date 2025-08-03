tell application "Terminal"
    activate
    set projectPath to "/Users/chrismcleod/Documents/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject"
    do script "cd " & quoted form of projectPath & " && npm run start-dev"
end tell