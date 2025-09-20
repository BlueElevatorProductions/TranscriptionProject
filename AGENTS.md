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
	1.	No manual log pasting
	•	The user will not paste logs.
	•	Agents must autonomously locate, open, and analyze logs.
	2.	Log Access Rule
	•	If the agent does not have access to the expected log files, it must immediately request access from the user.
	•	The request should specify which log path(s) are missing or inaccessible.
	•	The agent must not proceed with speculative fixes until log access is restored.
	3.	Troubleshooting Rule
	•	When troubleshooting CLI Codex issues:
	•	Attempt only one fix at a time.
	•	Confirm whether the fix resolved the issue before attempting another.
	•	Do not attempt multiple fixes in parallel, as this makes it unclear which action succeeded or caused side effects.
	•	Adding or expanding logs does not count as a fix and may be done at any time.
	4.	No Fallback Plans Without Permission
	•	Agents must not implement fallback plans (alternate methods, workarounds, or secondary strategies) unless explicitly approved by the user.
	•	Primary functionality should always be achieved with the primary method first.
	•	Only after confirming the primary method works may fallback strategies be proposed — and only if the user approves.
	5.	Adherence to Project Conventions
	•	Agents must follow the project’s README and launcher script conventions strictly.
	•	If logs are missing or behavior deviates, fail clearly and point to the missing path or inconsistency.