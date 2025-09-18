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

2. Logging System

Log Handling
	•	Reference File:
/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/App Descriptions/CodexLoggingSystem.rtf
	•	Key Principles:
	•	Logs are handled deterministically via environment variables and directories defined in the launcher script.
	•	Agents must create and read all logs themselves.
	•	The user will not paste logs manually.
	•	Agents must rely on:
	•	$EDL_DEBUG_DIR → JSON dumps of juce:updateEdl payloads.
	•	$JUCE_DEBUG_DIR → juce_debug.log for backend runtime decisions.
	•	Build logs (logs/juce_build_YYYYmmdd_HHMMSS.log).
	•	Electron and Vite logs (logs/electron_*.log, logs/vite_*.log).
	•	Fallback for JUCE logs is /tmp/juce_debug.log.

Agent Responsibility
	•	Continuously monitor and parse logs without requiring user intervention.
	•	Surface errors, anomalies, and session state based on edl_debug_latest.json and related files.
	•	Abort analysis if expected logs are missing and report the absence clearly.

⸻

3. Launcher Context

Launch Script
	•	Path:
/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject/start-transcription.sh
	•	Purpose:
	•	Exports log directories (EDL_DEBUG_DIR, JUCE_DEBUG_DIR).
	•	Creates required folders at runtime.
	•	Echoes environment paths so agents know where to look.
	•	Ensures reproducibility of log paths across sessions.

Agent Responsibility
	•	Assume the app has been launched via this script.
	•	Do not rely on ad hoc environment variables or inconsistent paths.
	•	Treat the launch script’s exports as the source of truth for log locations.

⸻

4. Agent Roles
	•	Log-Watcher Agent:
Reads juce_debug.log, edl_debug_latest.json, and build logs to extract diagnostic signals.
	•	Diagnostics Agent:
Inspects build logs, Electron/Vite logs, and backend traces to identify errors.

⸻

5. Expectations
	•	No manual log pasting by the user.
	•	Agents must autonomously locate, open, and analyze logs.
	•	If logs are missing, fail clearly and point to the missing path.
	•	Follow the project’s README and launcher script conventions strictly.

Troubleshooting Rule
	•	When troubleshooting an issue with CLI Codex:
	•	Attempt only one fix at a time.
	•	After applying a fix, confirm whether it resolved the issue before trying another.
	•	Do not attempt multiple fixes in parallel, as this makes it unclear which action succeeded or caused side effects.
	•	Adding or expanding logs does not count as a fix — logs may be added at any time to aid troubleshooting.