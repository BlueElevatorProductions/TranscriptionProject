#!/usr/bin/env python3
"""
Test script to verify WhisperX is working properly
"""

import whisperx
import numpy as np
import soundfile as sf
import tempfile
import os

def create_test_audio():
    """Create a simple test audio file"""
    # Generate 3 seconds of sine wave at 440 Hz (middle A)
    duration = 3.0  # seconds
    sample_rate = 16000  # Hz
    frequency = 440  # Hz
    
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio_data = np.sin(2 * np.pi * frequency * t) * 0.3
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    sf.write(temp_file.name, audio_data, sample_rate)
    temp_file.close()
    
    return temp_file.name

def test_whisperx():
    """Test WhisperX transcription"""
    print("Creating test audio file...")
    test_audio_path = create_test_audio()
    
    try:
        print("Loading WhisperX model...")
        model = whisperx.load_model("tiny", "cpu", compute_type="int8")
        
        print("Loading audio...")
        audio = whisperx.load_audio(test_audio_path)
        
        print("Running transcription...")
        result = model.transcribe(audio, batch_size=16)
        
        print("Transcription result:")
        print(f"Language: {result.get('language', 'unknown')}")
        print(f"Segments: {len(result.get('segments', []))}")
        
        if result.get('segments'):
            for i, segment in enumerate(result['segments']):
                print(f"Segment {i+1}: {segment.get('text', 'No text')}")
        
        print("WhisperX test completed successfully!")
        
    except Exception as e:
        print(f"Error testing WhisperX: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up temporary file
        if os.path.exists(test_audio_path):
            os.unlink(test_audio_path)

if __name__ == "__main__":
    test_whisperx()