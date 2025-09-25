Overview

This document defines the agents, their responsibilities, and their relationship to the project. It is intended as a guide for anyone working with or extending the agent system. Agents are expected to follow deterministic behaviors around logs, app launching, and context ingestion.

⸻

1. Core Knowledge Sources

Project README
	•	Path:
/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/README.md
	•	Purpose:
Provides baseline information about the app, its architecture, usage, and goals.
	•	Agent Responsibility:
Always ingest and respect the instructions outlined in this README before acting.

⸻

2. Logging System (CLI-Only)

⚠️ Important Scope Note
	•	The following logging rules apply only when running as a CLI agent (any CLI model).
	•	Web agents and other non-CLI agents should not attempt to enforce log access outside the repo.
	•	Web-based agents may reference log conventions conceptually, but must not assume filesystem access.

Log Handling
	•	Reference File:
/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/App Descriptions/CodexLoggingSystem.rtf
	•	Key Principles (CLI):
	•	CLI agents must create and read all logs themselves.
	•	The user will not paste logs manually.
	•	CLI agents must rely on:
	•	$EDL_DEBUG_DIR → JSON dumps of juce:updateEdl payloads.
	•	$JUCE_DEBUG_DIR → juce_debug.log for backend runtime decisions.
	•	Build logs (logs/juce_build_YYYYmmdd_HHMMSS.log).
	•	Electron and Vite logs (logs/electron_*.log, logs/vite_*.log).
	•	Fallback for JUCE logs is /tmp/juce_debug.log.

Agent Log Access Enhancements (CLI)
	1.	Environment File
	•	Path:
/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/logs/agent_env.sh
	•	CLI agents must source this file to automatically set $EDL_DEBUG_DIR and $JUCE_DEBUG_DIR.
	source /Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/logs/agent_env.sh

		2.	EDL Latest Symlink
	•	A symlink edl_debug_latest.json points to the most recent EDL debug file.
	•	Background process refreshes this symlink every 5 seconds during runtime.
	3.	Accessible Logs
	•	✅ edl_debug_latest.json → latest session data
	•	✅ juce/juce_debug.log → backend audio logs
	•	✅ logs/electron_*.log → renderer logs
	•	✅ logs/juce_build_*.log → build logs with timestamps
	•	✅ agent_env.sh → unified environment configuration

⸻

3. Launcher Context (CLI-Only)

Launch Script
	•	Path:
/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/start-transcription.sh
	•	Purpose:
	•	Exports log directories (EDL_DEBUG_DIR, JUCE_DEBUG_DIR).
	•	Creates required folders at runtime.
	•	Echoes environment paths.
	•	Ensures reproducibility of log paths across sessions.

⸻

4. Agent Roles
	•	Log-Watcher Agent (CLI):
Reads juce_debug.log, edl_debug_latest.json, and build logs to extract diagnostic signals.
	•	Diagnostics Agent (CLI):
Inspects build logs, Electron/Vite logs, and backend traces to identify errors.

⸻

5. Expectations
	1.	No manual log pasting (CLI)
	•	User will not paste logs.
	•	CLI agents must locate, open, and analyze logs autonomously.
	2.	Log Access Rule (CLI)
	•	If a CLI agent lacks access to expected logs, it must immediately request access.
	•	Must not proceed until access is restored.
	3.	Troubleshooting Rule
	•	Attempt only one fix at a time.
	•	Confirm fix before trying another.
	•	Adding logs is allowed anytime.
	4.	No Fallback Plans Without Permission
	•	Do not implement fallback plans without explicit user approval.
	•	Primary method must succeed first.
	5.	Push Rule (CLI + Web)
	•	Agents must not push commits/branches unless explicitly instructed.
	•	Local staging/review is allowed, but pushing is off-limits.
	6.	Adherence to Project Conventions
	•	Follow the project’s README, launcher script, and CLI log rules strictly.
	•	Web agents are exempt from filesystem logging expectations.