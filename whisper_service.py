#!/usr/bin/env python3
"""
WhisperX Transcription Service
Provides on-device audio transcription for the PodcastTranscriber app
"""

import json
import sys
import os
import tempfile
import traceback
import warnings
from pathlib import Path
import whisperx

# Suppress warnings and verbose output
warnings.filterwarnings("ignore")
os.environ['TRANSFORMERS_VERBOSITY'] = 'error'

class WhisperService:
    def __init__(self):
        self.model = None
        self.device = "cpu"  # Can be changed to "cuda" if NVIDIA GPU available
        self.compute_type = "int8"  # For CPU inference
        
    def load_model(self, model_size="base"):
        """Load WhisperX model"""
        try:
            self.model = whisperx.load_model(model_size, self.device, compute_type=self.compute_type)
            return {"status": "success", "message": f"Model {model_size} loaded successfully"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to load model: {str(e)}"}
    
    def transcribe_audio(self, audio_path, model_size="base", batch_size=16, language="en"):
        """Transcribe audio file and return results with timestamps"""
        try:
            # Redirect stderr to suppress verbose output
            import io
            import contextlib
            
            # Load model if not already loaded
            if self.model is None:
                with contextlib.redirect_stderr(io.StringIO()):
                    result = self.load_model(model_size)
                    if result["status"] == "error":
                        return result
            
            # Load audio
            with contextlib.redirect_stderr(io.StringIO()):
                audio = whisperx.load_audio(audio_path)
            
            # Transcribe with punctuation-focused settings
            with contextlib.redirect_stderr(io.StringIO()):
                result = self.model.transcribe(
                    audio, 
                    batch_size=batch_size,
                    language=language,  # Explicit language for better punctuation
                    task="transcribe",  # Explicitly specify transcription task
                    initial_prompt="Please include proper punctuation, capitalization, and formatting. Use periods, commas, question marks, and other punctuation marks as appropriate."  # Prompt for better punctuation
                )
            
            # Load alignment model and align whisper output
            with contextlib.redirect_stderr(io.StringIO()):
                model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=self.device)
                result = whisperx.align(result["segments"], model_a, metadata, audio, self.device, return_char_alignments=False)
            
            # Diarization (speaker detection)
            try:
                # NOTE: Diarization may require a Hugging Face authentication token
                # to be configured in the environment, e.g., via `huggingface-cli login`.
                # The underlying pyannote.audio library will download models, and errors
                # during this process will now be reported to the main application.
                import torch
                
                print("INFO: Initializing speaker diarization pipeline...", file=sys.stderr)
                diarize_model = whisperx.diarize.DiarizationPipeline(device=self.device)
                
                print("INFO: Diarization pipeline loaded. Running diarization...", file=sys.stderr)
                diarize_segments = diarize_model(audio)
                
                print("INFO: Diarization complete. Assigning speakers...", file=sys.stderr)
                result = whisperx.assign_word_speakers(diarize_segments, result)
                print("INFO: Speaker assignment complete.", file=sys.stderr)
                
            except Exception as diarization_error:
                error_message = f"Speaker diarization failed: {str(diarization_error)}. This can be caused by a missing Hugging Face authentication token or a network issue preventing model downloads. Please check the terminal output for more details."
                print(f"ERROR: {error_message}", file=sys.stderr)
                # Return a proper error to be handled by the frontend
                return {
                    "status": "error", 
                    "message": error_message,
                    "traceback": traceback.format_exc()
                }
            
            return {
                "status": "success", 
                "transcription": result,
                "language": result.get("language", "unknown"),
                "segments": result.get("segments", [])
            }
            
        except Exception as e:
            return {
                "status": "error", 
                "message": f"Transcription failed: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def get_supported_formats(self):
        """Return list of supported audio formats"""
        return {
            "status": "success",
            "formats": [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".wma", ".aac"]
        }

def main():
    """Main function to handle command line interface"""
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No command provided"}))
        sys.exit(1)
    
    command = sys.argv[1]
    service = WhisperService()
    
    if command == "transcribe":
        if len(sys.argv) < 3:
            print(json.dumps({"status": "error", "message": "No audio file provided"}))
            sys.exit(1)
        
        audio_path = sys.argv[2]
        model_size = sys.argv[3] if len(sys.argv) > 3 else "base"
        language = sys.argv[4] if len(sys.argv) > 4 else "en"
        
        if not os.path.exists(audio_path):
            print(json.dumps({"status": "error", "message": "Audio file does not exist"}))
            sys.exit(1)
        
        result = service.transcribe_audio(audio_path, model_size, language=language)
        print(json.dumps(result, indent=2))
        
    elif command == "load_model":
        model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
        result = service.load_model(model_size)
        print(json.dumps(result, indent=2))
        
    elif command == "formats":
        result = service.get_supported_formats()
        print(json.dumps(result, indent=2))
        
    else:
        print(json.dumps({"status": "error", "message": f"Unknown command: {command}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()