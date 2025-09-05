#!/usr/bin/env python3
"""
Whisper Service for Local Transcription
Provides local transcription using OpenAI Whisper or WhisperX
"""

import sys
import json
import argparse
import os
import subprocess
import tempfile
from pathlib import Path

def print_progress(percentage):
    """Print progress to stderr for the main process to parse"""
    print(f"PROGRESS:{percentage}", file=sys.stderr, flush=True)

def check_whisper_installation():
    """Check if whisper or whisperx is available"""
    try:
        import whisper
        return 'whisper'
    except ImportError:
        pass
    
    try:
        import whisperx
        return 'whisperx'
    except ImportError:
        pass
    
    # Fallback to command-line whisper if available
    try:
        result = subprocess.run(['whisper', '--help'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return 'whisper-cli'
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    
    return None

def transcribe_with_whisper_lib(audio_path, model_size='base', language=None):
    """Transcribe using whisper library"""
    import whisper
    
    print_progress(10)
    
    # Load model
    print(f"Loading Whisper model: {model_size}", file=sys.stderr)
    model = whisper.load_model(model_size)
    print_progress(30)
    
    # Transcribe
    print(f"Transcribing audio: {audio_path}", file=sys.stderr)
    options = {}
    if language:
        options['language'] = language
    
    result = model.transcribe(audio_path, **options)
    print_progress(90)
    
    # Convert to expected format
    segments = []
    for i, segment in enumerate(result.get('segments', [])):
        segment_data = {
            'id': i,
            'start': segment.get('start', 0.0),
            'end': segment.get('end', 0.0),
            'text': segment.get('text', '').strip(),
            'speaker': 'SPEAKER_00',
            'words': []
        }
        
        # Add word-level timing if available
        if 'words' in segment:
            for word in segment['words']:
                segment_data['words'].append({
                    'start': word.get('start', 0.0),
                    'end': word.get('end', 0.0),
                    'word': word.get('word', '').strip(),
                    'score': word.get('probability', 0.9)
                })
        
        segments.append(segment_data)
    
    return {
        'status': 'success',
        'segments': segments,
        'language': result.get('language', 'unknown')
    }

def transcribe_with_whisperx(audio_path, model_size='base', language=None):
    """Transcribe using WhisperX library"""
    import whisperx
    import torch
    
    print_progress(10)
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if torch.cuda.is_available() else "float32"
    
    # Load model
    print(f"Loading WhisperX model: {model_size}", file=sys.stderr)
    model = whisperx.load_model(model_size, device, compute_type=compute_type)
    print_progress(30)
    
    # Load audio
    print(f"Loading audio: {audio_path}", file=sys.stderr)
    audio = whisperx.load_audio(audio_path)
    print_progress(40)
    
    # Transcribe
    print(f"Transcribing audio", file=sys.stderr)
    result = model.transcribe(audio, batch_size=16)
    print_progress(70)
    
    # Align whisper output (optional but recommended)
    try:
        model_a, metadata = whisperx.load_align_model(
            language_code=result["language"], device=device
        )
        result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
        print_progress(85)
    except Exception as e:
        print(f"Warning: Alignment failed: {e}", file=sys.stderr)
    
    # Diarization (speaker identification) - optional
    try:
        diarize_model = whisperx.DiarizationPipeline(use_auth_token="YOUR_HF_TOKEN", device=device)
        diarize_segments = diarize_model(audio)
        result = whisperx.assign_word_speakers(diarize_segments, result)
        print_progress(90)
    except Exception as e:
        print(f"Warning: Speaker diarization failed: {e}", file=sys.stderr)
    
    # Convert to expected format
    segments = []
    for i, segment in enumerate(result.get('segments', [])):
        segment_data = {
            'id': i,
            'start': segment.get('start', 0.0),
            'end': segment.get('end', 0.0),
            'text': segment.get('text', '').strip(),
            'speaker': segment.get('speaker', 'SPEAKER_00'),
            'words': []
        }
        
        # Add word-level timing if available
        if 'words' in segment:
            for word in segment['words']:
                segment_data['words'].append({
                    'start': word.get('start', 0.0),
                    'end': word.get('end', 0.0),
                    'word': word.get('word', '').strip(),
                    'score': word.get('score', 0.9)
                })
        
        segments.append(segment_data)
    
    return {
        'status': 'success',
        'segments': segments,
        'language': result.get('language', 'unknown')
    }

def transcribe_with_cli(audio_path, model_size='base', language=None):
    """Transcribe using whisper command-line tool"""
    print_progress(10)
    
    # Create temporary directory for output
    with tempfile.TemporaryDirectory() as temp_dir:
        # Build command
        cmd = [
            'whisper', audio_path,
            '--model', model_size,
            '--output_dir', temp_dir,
            '--output_format', 'json',
            '--verbose', 'False'
        ]
        
        if language:
            cmd.extend(['--language', language])
        
        print(f"Running command: {' '.join(cmd)}", file=sys.stderr)
        print_progress(30)
        
        # Run transcription
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            print_progress(80)
            
            if result.returncode != 0:
                raise Exception(f"Whisper CLI failed: {result.stderr}")
            
            # Find the output JSON file
            audio_name = Path(audio_path).stem
            json_file = Path(temp_dir) / f"{audio_name}.json"
            
            if not json_file.exists():
                raise Exception(f"Output JSON file not found: {json_file}")
            
            # Parse the result
            with open(json_file, 'r', encoding='utf-8') as f:
                whisper_result = json.load(f)
            
            print_progress(90)
            
            # Convert to expected format
            segments = []
            for i, segment in enumerate(whisper_result.get('segments', [])):
                segment_data = {
                    'id': i,
                    'start': segment.get('start', 0.0),
                    'end': segment.get('end', 0.0),
                    'text': segment.get('text', '').strip(),
                    'speaker': 'SPEAKER_00',
                    'words': []
                }
                segments.append(segment_data)
            
            return {
                'status': 'success',
                'segments': segments,
                'language': whisper_result.get('language', 'unknown')
            }
            
        except subprocess.TimeoutExpired:
            raise Exception("Transcription timed out after 5 minutes")
        except Exception as e:
            raise Exception(f"CLI transcription failed: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Whisper transcription service')
    parser.add_argument('command', choices=['transcribe'], help='Command to execute')
    parser.add_argument('audio_file', help='Path to audio file')
    parser.add_argument('--model', default='base', help='Whisper model size (tiny, base, small, medium, large)')
    parser.add_argument('--language', help='Language code (optional)')
    
    args = parser.parse_args()
    
    try:
        # Check if audio file exists
        if not os.path.exists(args.audio_file):
            raise Exception(f"Audio file not found: {args.audio_file}")
        
        print_progress(5)
        
        # Check which whisper implementation is available
        whisper_type = check_whisper_installation()
        
        if whisper_type is None:
            raise Exception(
                "No Whisper installation found. Please install whisper or whisperx:\n"
                "pip install openai-whisper\n"
                "or\n"
                "pip install whisperx"
            )
        
        print(f"Using Whisper implementation: {whisper_type}", file=sys.stderr)
        
        # Transcribe based on available implementation
        if whisper_type == 'whisperx':
            result = transcribe_with_whisperx(args.audio_file, args.model, args.language)
        elif whisper_type == 'whisper':
            result = transcribe_with_whisper_lib(args.audio_file, args.model, args.language)
        elif whisper_type == 'whisper-cli':
            result = transcribe_with_cli(args.audio_file, args.model, args.language)
        else:
            raise Exception(f"Unknown whisper type: {whisper_type}")
        
        print_progress(100)
        
        # Output result as JSON
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'status': 'error',
            'message': str(e),
            'segments': []
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()