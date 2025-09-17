# JUCE Time-Stretching Implementation Guide

## Overview
This document outlines the implementation of pitch-preserving time-stretching in the JUCE backend to support variable playback speeds without changing pitch (no "chipmunk" or "slow-mo" effects).

## Frontend Integration ✅ COMPLETED

The TypeScript frontend has been updated to support time-stretching:

### 1. Transport Interface Updates ✅
- Added `setTimeStretch(id: string, ratio: number)` to `Transport` interface
- Added `{ type: 'setTimeStretch'; id: TransportId; ratio: number }` to `JuceCommand` union
- Updated type guards in `isJuceCommand()` function

### 2. IPC Bridge Updates ✅  
- Added `juce:setTimeStretch` IPC handler in `main.ts`
- Exposed `setTimeStretch` method in preload script
- Updated Window type definitions for renderer access

### 3. Audio Manager Updates ✅
- Modified `setPlaybackRate()` to use `setTimeStretch()` by default
- Added fallback to legacy `setRate()` if time-stretching fails
- Preserved backward compatibility with `setPlaybackRateLegacy()`

## JUCE Backend Implementation Required

The JUCE backend needs to be updated to handle the new `setTimeStretch` command and implement SoundTouch-based time-stretching.

### Required JUCE Components

#### 1. SoundTouch Integration
```cpp
#include <juce_audio_processors/juce_audio_processors.h>

// Option A: Direct SoundTouch Integration
class TimeStretchAudioSource : public juce::AudioSource
{
public:
    TimeStretchAudioSource(juce::AudioSource* source, bool deleteWhenRemoved)
        : inputSource(source, deleteWhenRemoved)
    {
        soundTouch.setSampleRate(44100);
        soundTouch.setChannels(2);
        soundTouch.setTempoChange(0); // 0% change initially
        soundTouch.setPitchSemiTones(0); // No pitch change
    }
    
    void setTimeStretchRatio(double ratio)
    {
        // ratio = 1.5 means 1.5x speed (50% faster)
        // ratio = 0.5 means 0.5x speed (50% slower)
        double tempoChange = (ratio - 1.0) * 100.0;
        soundTouch.setTempoChange(tempoChange);
    }
    
    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override
    {
        inputSource.prepareToPlay(samplesPerBlockExpected, sampleRate);
        soundTouch.setSampleRate(sampleRate);
    }
    
    void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override
    {
        // Implement SoundTouch processing here
        // 1. Get input from inputSource
        // 2. Process through SoundTouch
        // 3. Fill output buffer
    }
    
private:
    juce::OptionalScopedPointer<juce::AudioSource> inputSource;
    soundtouch::SoundTouch soundTouch;
    // Add buffers for processing
};

// Option B: Use JUCE's Built-in Time-Stretching (Simpler)
class JuceTimeStretchSource : public juce::AudioSource
{
public:
    JuceTimeStretchSource(juce::AudioSource* source)
        : resamplingSource(source, false, 2)
    {
    }
    
    void setTimeStretchRatio(double ratio)
    {
        // JUCE's ResamplingAudioSource can do time-stretching
        resamplingSource.setResamplingRatio(1.0 / ratio);
    }
    
    // Implement other AudioSource methods...
    
private:
    juce::ResamplingAudioSource resamplingSource;
};
```

#### 2. Command Handler Update
Update the JUCE backend's command processing to handle `setTimeStretch`:

```cpp
// In your command processor
void handleSetTimeStretch(const nlohmann::json& cmd)
{
    auto id = cmd["id"].get<std::string>();
    auto ratio = cmd["ratio"].get<double>();
    
    // Find the audio session by ID
    auto session = findSession(id);
    if (session && session->timeStretchSource)
    {
        session->timeStretchSource->setTimeStretchRatio(ratio);
        
        // Send success response
        nlohmann::json response;
        response["type"] = "success";
        response["id"] = id;
        sendResponse(response);
    }
    else
    {
        // Send error response
        nlohmann::json error;
        error["type"] = "error";
        error["id"] = id;
        error["message"] = "Time-stretching not available for session";
        sendResponse(error);
    }
}
```

#### 3. Audio Session Structure Update
```cpp
struct AudioSession
{
    std::string id;
    std::unique_ptr<juce::AudioFormatReaderSource> readerSource;
    std::unique_ptr<TimeStretchAudioSource> timeStretchSource; // New
    std::unique_ptr<juce::ResamplingAudioSource> resamplingSource;
    std::unique_ptr<juce::AudioTransportSource> transportSource;
    // ... other members
};
```

#### 4. Initialization Changes
```cpp
void AudioSession::initialize(const std::string& audioPath)
{
    // 1. Create reader source
    readerSource = std::make_unique<juce::AudioFormatReaderSource>(reader, true);
    
    // 2. Create time-stretch source
    timeStretchSource = std::make_unique<TimeStretchAudioSource>(readerSource.get(), false);
    
    // 3. Create transport source with time-stretch source
    transportSource = std::make_unique<juce::AudioTransportSource>();
    transportSource->setSource(timeStretchSource.get(), 0, nullptr, reader->sampleRate);
    
    // 4. Connect to audio device
    audioDeviceManager.addAudioCallback(this);
}
```

### Implementation Options

#### Option 1: SoundTouch Library (Recommended)
- **Pros**: Industry-standard, excellent quality, widely used
- **Cons**: External dependency
- **Setup**: Add SoundTouch to JUCE project dependencies
- **Quality**: Excellent pitch preservation, natural sound

#### Option 2: JUCE Built-in ResamplingAudioSource
- **Pros**: No external dependencies, already available in JUCE
- **Cons**: May have lower quality than SoundTouch
- **Setup**: Use `juce::ResamplingAudioSource` with time-stretching mode
- **Quality**: Good, but not as advanced as SoundTouch

#### Option 3: JUCE SoundTouchAudioSource (If Available)
- **Pros**: JUCE wrapper around SoundTouch
- **Cons**: May not be available in all JUCE versions
- **Setup**: Check if `juce::SoundTouchAudioSource` exists in your JUCE version

### Recommended Implementation Steps

1. **Choose Implementation**: Start with Option 2 (JUCE built-in) for simplicity
2. **Add Command Handler**: Implement `setTimeStretch` command processing
3. **Update Audio Chain**: Integrate time-stretching into audio session pipeline
4. **Test Integration**: Verify frontend can control time-stretching
5. **Upgrade to SoundTouch**: If quality is insufficient, upgrade to SoundTouch

### Testing

Create test cases for:
- Speed ranges: 0.5x to 2.0x playback speed
- Quality verification: Ensure no pitch changes
- Performance: Monitor CPU usage during time-stretching
- Edge cases: Very slow (0.25x) and fast (4.0x) speeds

### Expected Results

After implementation:
- ✅ Variable playback speeds (0.5x to 2.0x) without pitch changes
- ✅ Professional audio quality suitable for transcription work
- ✅ Seamless integration with existing transport controls
- ✅ Fallback to legacy rate changes if time-stretching fails

### Files Modified ✅

Frontend changes (already completed):
- `src/shared/types/transport.ts` - Added setTimeStretch command
- `src/main/services/JuceClient.ts` - Added setTimeStretch method
- `src/main/preload.ts` - Exposed setTimeStretch to renderer
- `src/main/main.ts` - Added IPC handler
- `src/renderer/audio/JuceAudioManager.ts` - Updated to use time-stretching

Backend changes (required):
- JUCE command processor - Add setTimeStretch handler
- Audio session management - Integrate time-stretching source
- Audio pipeline - Update audio chain with time-stretching

### Benefits

- **Better User Experience**: Natural voice at different speeds
- **Professional Quality**: Suitable for podcasting/transcription work
- **Industry Standard**: Matches expectations from professional audio tools
- **Backward Compatible**: Legacy rate changes still available as fallback