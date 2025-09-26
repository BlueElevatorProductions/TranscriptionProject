// JUCE audio engine backend with mock fallback.
// Build with -DUSE_JUCE=ON and set JUCE_DIR to compile real audio engine.

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <ctime>

#ifdef USE_JUCE
#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_core/juce_core.h>
#endif

struct State {
  std::string id;
  std::atomic<bool> playing{false};
  std::atomic<bool> running{true};
  std::atomic<double> editedSec{0.0};
  double durationSec{60.0};
};

static State g;
static std::mutex gMutex;

static constexpr double kMinDuration = 1e-4; // 0.1 ms guard against zero-length ranges

static double sanitizeTime(double value, double fallback = 0.0) {
  if (!std::isfinite(value)) return fallback;
  if (value < 0.0) return 0.0;
  // Protect against absurd values that could destabilize JUCE transport
  constexpr double kMaxReasonableTime = 24.0 * 60.0 * 60.0; // 24 hours
  if (value > kMaxReasonableTime) return kMaxReasonableTime;
  return value;
}

static double sanitizeDuration(double value) {
  if (!std::isfinite(value)) return 0.0;
  if (value < kMinDuration) return 0.0;
  return value;
}

// --- Debug logging helpers (write to JUCE_DEBUG_DIR or /tmp) ---
static std::string juceDebugPath() {
  const char* dir = std::getenv("JUCE_DEBUG_DIR");
  std::string base = (dir && *dir) ? std::string(dir) : std::string("/tmp");
  // We do not attempt to create directories here to keep dependencies light.
  return base + "/juce_debug.log";
}
static void juceDLog(const std::string& line) {
  try {
    std::ofstream f(juceDebugPath(), std::ios::app);
    f << line << std::endl;
  } catch (...) {}
}

static void emit(const std::string& json) {
  std::cout << json << "\n";
  std::cout.flush();
}

static void emitLoaded(double sampleRate = 48000.0, int channels = 2) {
  emit(std::string("{") +
       "\"type\":\"loaded\",\"id\":\"" + g.id + "\",\"durationSec\":" + std::to_string(g.durationSec) +
       ",\"sampleRate\":" + std::to_string((int)sampleRate) + ",\"channels\":" + std::to_string(channels) + "}");
}

static void emitState() {
  emit(std::string("{") +
       "\"type\":\"state\",\"id\":\"" + g.id + "\",\"playing\":" + (g.playing ? "true" : "false") + "}");
}

static void emitPosition() {
  // originalSec mirrors editedSec in this mock
  const double es = g.editedSec.load();
  emit(std::string("{") +
       "\"type\":\"position\",\"id\":\"" + g.id + "\",\"editedSec\":" + std::to_string(es) +
       ",\"originalSec\":" + std::to_string(es) + "}");
}

static void timerThread() {
  using namespace std::chrono_literals;
  while (g.running) {
    if (g.playing) {
      g.editedSec.store(g.editedSec.load() + 0.033); // ~30 Hz
      if (g.editedSec >= g.durationSec) {
        g.playing = false;
        emit("{\"type\":\"ended\",\"id\":\"" + g.id + "\"}");
      } else {
        emitPosition();
      }
    }
    std::this_thread::sleep_for(33ms);
  }
}

static void handleLine(const std::string& line) {
  // Extremely simple command parsing to avoid JSON dependencies
  auto contains = [&](const char* s) { return line.find(s) != std::string::npos; };
  auto extract = [&](const char* key) -> std::string {
    // extract value for key in a very naive way: "key":"value" or numeric
    std::string k = std::string("\"") + key + "\":";
    size_t p = line.find(k);
    if (p == std::string::npos) return {};
    p += k.size();
    if (p >= line.size()) return {};
    if (line[p] == '"') {
      size_t end = line.find('"', p + 1);
      if (end == std::string::npos) return {};
      return line.substr(p + 1, end - (p + 1));
    } else {
      size_t end = line.find_first_of(",}\n", p);
      if (end == std::string::npos) end = line.size();
      return line.substr(p, end - p);
    }
  };

  if (contains("\"type\":\"load\"")) {
    std::lock_guard<std::mutex> lock(gMutex);
    g.id = extract("id");
    g.editedSec = 0.0;
    g.playing = false;
    emitLoaded();
    emitState();
    return;
  }
  if (contains("\"type\":\"play\"")) {
    g.playing = true;
    emitState();
    return;
  }
  if (contains("\"type\":\"pause\"")) {
    g.playing = false;
    emitState();
    return;
  }
  if (contains("\"type\":\"stop\"")) {
    g.playing = false;
    g.editedSec = 0.0;
    emitState();
    emitPosition();
    return;
  }
  if (contains("\"type\":\"seek\"")) {
    const std::string t = extract("timeSec");
    try { g.editedSec = std::stod(t); } catch (...) {}
    emitPosition();
    return;
  }
  if (contains("\"type\":\"queryState\"")) {
    emitState();
    emitPosition();
    return;
  }
  if (contains("\"type\":\"updateEdlFromFile\"")) {
    const std::string path = extract("path");
    if (!path.empty()) {
      std::remove(path.c_str());
    }
    return;
  }
  if (contains("\"type\":\"updateEdl\"")) {
    // Accept silently in mock handler
    return;
  }
  if (contains("\"type\":\"setRate\"") || contains("\"type\":\"setVolume\"")) {
    // Accept silently
    return;
  }
  emit("{\"type\":\"error\",\"message\":\"unknown command\"}");
}

#ifdef USE_JUCE
// --- JUCE Implementation ---

// Individual word or spacer within a clip
struct Segment {
  std::string type;        // "word" or "spacer"
  double start;            // Start time
  double end;              // End time
  double dur;              // Duration
  std::string text;        // Text content (for words, empty for spacers)
  double originalStart = -1; // Original timing (if provided)
  double originalEnd = -1;   // Original timing (if provided)

  bool hasOriginal() const { return originalStart >= 0 && originalEnd >= 0; }
};

// Clip container holding segments (words and spacers)
struct Clip {
  std::string id;
  double startSec;         // Clip start in EDL timeline
  double endSec;           // Clip end in EDL timeline
  double originalStartSec = -1; // Original audio position
  double originalEndSec = -1;   // Original audio position
  std::string speaker;
  std::string type;        // "speech", etc.
  std::vector<Segment> segments; // Words and spacers within this clip

  double duration() const { return endSec - startSec; }
  bool hasOriginal() const { return originalStartSec >= 0 && originalEndSec >= 0; }
  size_t segmentCount() const { return segments.size(); }
};

static bool parseClipsFromJsonPayload(const std::string& json, std::vector<Clip>& clipsOut, int* revisionOut = nullptr) {
  clipsOut.clear();

  auto findClipsArray = [&](size_t& aStart, size_t& aEnd) -> bool {
    size_t key = json.find("\"clips\"");
    if (key == std::string::npos) return false;
    size_t colon = json.find(':', key);
    if (colon == std::string::npos) return false;
    size_t lb = json.find('[', colon);
    if (lb == std::string::npos) return false;
    int depth = 1;
    size_t i = lb + 1;
    while (i < json.size() && depth > 0) {
      if (json[i] == '[') depth++;
      else if (json[i] == ']') depth--;
      i++;
    }
    if (depth != 0) return false;
    aStart = lb + 1;
    aEnd = i - 1;
    return true;
  };

  size_t aStart = 0;
  size_t aEnd = 0;
  if (!findClipsArray(aStart, aEnd)) {
    return false;
  }

  std::vector<std::string> itemStrings;
  size_t cursor = aStart;
  while (cursor < aEnd) {
    while (cursor < aEnd && (json[cursor] == ' ' || json[cursor] == ',' || json[cursor] == '\n' || json[cursor] == '\r' || json[cursor] == '\t')) cursor++;
    if (cursor >= aEnd) break;
    if (json[cursor] != '{') {
      cursor++;
      continue;
    }

    int depth = 1;
    size_t objStart = cursor;
    cursor++;
    while (cursor < aEnd && depth > 0) {
      if (json[cursor] == '{') depth++;
      else if (json[cursor] == '}') depth--;
      cursor++;
    }

    size_t objEnd = cursor;
    itemStrings.push_back(json.substr(objStart, objEnd - objStart));
  }

  auto extractNumber = [&](const std::string& s, const char* key) -> double {
    size_t p = s.find(key);
    if (p == std::string::npos) return std::numeric_limits<double>::quiet_NaN();
    size_t c = s.find(':', p);
    if (c == std::string::npos) return std::numeric_limits<double>::quiet_NaN();
    size_t e = s.find_first_of(",}\n", c + 1);
    std::string token = s.substr(c + 1, (e == std::string::npos ? s.size() : e) - (c + 1));
    try {
      return std::stod(token);
    } catch (...) {
      return std::numeric_limits<double>::quiet_NaN();
    }
  };

  auto extractString = [&](const std::string& s, const char* key) -> std::string {
    size_t p = s.find(key);
    if (p == std::string::npos) return {};
    size_t c = s.find(':', p);
    if (c == std::string::npos) return {};
    size_t qs = s.find('"', c);
    if (qs == std::string::npos) return {};
    size_t qe = s.find('"', qs + 1);
    if (qe == std::string::npos) return {};
    return s.substr(qs + 1, qe - (qs + 1));
  };

  if (revisionOut) {
    double revValue = extractNumber(json, "\"revision\"");
    if (revValue == revValue) {
      *revisionOut = static_cast<int>(revValue);
    }
  }

  for (const auto& clipJson : itemStrings) {
    Clip clip;
    clip.id = extractString(clipJson, "\"id\"");

    const double startSecRaw = extractNumber(clipJson, "\"startSec\"");
    const double endSecRaw = extractNumber(clipJson, "\"endSec\"");
    clip.startSec = sanitizeTime(startSecRaw);
    clip.endSec = sanitizeTime(endSecRaw, clip.startSec);

    const double clipDur = sanitizeDuration(clip.endSec - clip.startSec);
    if (clipDur <= 0.0) {
      continue;
    }

    clip.originalStartSec = extractNumber(clipJson, "\"originalStartSec\"");
    clip.originalEndSec = extractNumber(clipJson, "\"originalEndSec\"");
    if (!(clip.originalStartSec == clip.originalStartSec && clip.originalEndSec == clip.originalEndSec)) {
      clip.originalStartSec = -1;
      clip.originalEndSec = -1;
    } else {
      clip.originalStartSec = sanitizeTime(clip.originalStartSec, clip.startSec);
      clip.originalEndSec = sanitizeTime(clip.originalEndSec, clip.originalStartSec);
      if (sanitizeDuration(clip.originalEndSec - clip.originalStartSec) <= 0.0) {
        clip.originalStartSec = -1;
        clip.originalEndSec = -1;
      }
    }

    clip.speaker = extractString(clipJson, "\"speaker\"");
    clip.type = extractString(clipJson, "\"type\"");

    size_t segStart = clipJson.find("\"segments\"");
    if (segStart != std::string::npos) {
      size_t segArrayStart = clipJson.find('[', segStart);
      if (segArrayStart != std::string::npos) {
        int segDepth = 1;
        size_t segCursor = segArrayStart + 1;
        while (segCursor < clipJson.size() && segDepth > 0) {
          if (clipJson[segCursor] == '[') segDepth++;
          else if (clipJson[segCursor] == ']') segDepth--;
          segCursor++;
        }

        if (segDepth == 0) {
          std::string segArrayContent = clipJson.substr(segArrayStart + 1, segCursor - segArrayStart - 2);
          size_t segPos = 0;
          while (segPos < segArrayContent.size()) {
            while (segPos < segArrayContent.size() && (segArrayContent[segPos] == ' ' || segArrayContent[segPos] == ',' || segArrayContent[segPos] == '\n' || segArrayContent[segPos] == '\r' || segArrayContent[segPos] == '\t')) segPos++;
            if (segPos >= segArrayContent.size()) break;
            if (segArrayContent[segPos] != '{') {
              segPos++;
              continue;
            }

            int segDepth2 = 1;
            size_t segObjStart = segPos;
            segPos++;
            while (segPos < segArrayContent.size() && segDepth2 > 0) {
              if (segArrayContent[segPos] == '{') segDepth2++;
              else if (segArrayContent[segPos] == '}') segDepth2--;
              segPos++;
            }

            std::string segJson = segArrayContent.substr(segObjStart, segPos - segObjStart);
            Segment segment;
            segment.type = extractString(segJson, "\"type\"");

            const double segStartRaw = extractNumber(segJson, "\"startSec\"");
            const double segEndRaw = extractNumber(segJson, "\"endSec\"");
            if (!(segStartRaw == segStartRaw && segEndRaw == segEndRaw)) {
              continue;
            }

            const double segStartSafe = sanitizeTime(segStartRaw);
            const double segEndSafe = sanitizeTime(segEndRaw, segStartSafe);
            const double segDurSafe = sanitizeDuration(segEndSafe - segStartSafe);
            if (segDurSafe <= 0.0) {
              continue;
            }

            segment.start = segStartSafe;
            segment.end = segStartSafe + segDurSafe;
            segment.dur = segDurSafe;
            segment.text = extractString(segJson, "\"text\"");

            segment.originalStart = extractNumber(segJson, "\"originalStartSec\"");
            segment.originalEnd = extractNumber(segJson, "\"originalEndSec\"");
            if (segment.originalStart == segment.originalStart && segment.originalEnd == segment.originalEnd) {
              segment.originalStart = sanitizeTime(segment.originalStart, 0.0);
              segment.originalEnd = sanitizeTime(segment.originalEnd, segment.originalStart);
              if (sanitizeDuration(segment.originalEnd - segment.originalStart) <= 0.0) {
                segment.originalStart = -1;
                segment.originalEnd = -1;
              }
            } else {
              segment.originalStart = -1;
              segment.originalEnd = -1;
            }

            clip.segments.push_back(segment);
          }
        }
      }
    }

    if (!clip.segments.empty()) {
      clipsOut.push_back(clip);
    }
  }

  return true;
}

// Custom AudioSource that handles Edit Decision List (EDL) playback
class EdlAudioSource : public juce::PositionableAudioSource {
public:
  EdlAudioSource(juce::AudioFormatReaderSource* readerSource) : reader(readerSource) {}
  
  void updateSegments(const std::vector<Segment>& newSegments, bool isContiguous) {
    segments = newSegments;
    contiguousMode = isContiguous;
    currentSegmentIndex = 0;
    editedPosition = 0.0;
  }
  
  void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override {
    if (reader) reader->prepareToPlay(samplesPerBlockExpected, sampleRate);

    // Safety check and logging for dynamic sample rate
    if (sampleRate <= 0.0) {
      juceDLog("[JUCE] WARNING: Invalid sample rate in prepareToPlay: " + std::to_string(sampleRate));
      this->sampleRate = 48000.0; // Fallback to reasonable default
    } else {
      this->sampleRate = sampleRate;
    }

    juceDLog("[JUCE] EdlAudioSource prepared with sample rate: " + std::to_string(this->sampleRate));
  }
  
  void releaseResources() override {
    if (reader) reader->releaseResources();
  }
  
  void getNextAudioBlock(const juce::AudioSourceChannelInfo& bufferToFill) override {
    bufferToFill.clearActiveBufferRegion();

    if (!reader || segments.empty()) {
      juceDLog("[JUCE] getNextAudioBlock: reader=" + std::to_string(reader != nullptr) +
               ", segments.size=" + std::to_string(segments.size()));
      return;
    }

    // Safety check for sample rate before calculations
    if (sampleRate <= 1.0) {  // Must be at least 1Hz
      juceDLog("[JUCE] ERROR: Invalid sample rate in getNextAudioBlock: " + std::to_string(sampleRate));
      return;
    }
    
    int samplesNeeded = bufferToFill.numSamples;
    int samplesWritten = 0;
    
    while (samplesNeeded > 0 && currentSegmentIndex < segments.size()) {
      // Bounds check for segment access
      if (currentSegmentIndex >= segments.size()) {
        juceDLog("[JUCE] ERROR: currentSegmentIndex out of bounds: " + std::to_string(currentSegmentIndex) +
                 "/" + std::to_string(segments.size()));
        break;
      }
      const auto& segment = segments[currentSegmentIndex];
      
      // Calculate positions in samples
      int64_t segmentStartSample, segmentEndSample;
      double segmentDuration;
      
      if (contiguousMode && segment.hasOriginal()) {
        // For reordered clips, use original audio positions
        segmentStartSample = (int64_t)(segment.originalStart * sampleRate);
        segmentEndSample = (int64_t)(segment.originalEnd * sampleRate);
        segmentDuration = segment.originalEnd - segment.originalStart;
      } else {
        // For normal clips, use regular positions  
        segmentStartSample = (int64_t)(segment.start * sampleRate);
        segmentEndSample = (int64_t)(segment.end * sampleRate);
        segmentDuration = segment.dur;
      }
      
      // Calculate relative position within this segment (in edited timeline)
      double relativeEditedPos = editedPosition - segment.start;
      if (relativeEditedPos < 0) relativeEditedPos = 0;
      
      // Map to original audio position
      double relativeProgress = relativeEditedPos / (segment.end - segment.start);
      int64_t currentOriginalSample = segmentStartSample + (int64_t)(relativeProgress * (segmentEndSample - segmentStartSample));
      
      // How many samples left in this segment?
      int64_t samplesLeftInSegment = segmentEndSample - currentOriginalSample;
      int samplesToRead = std::min(samplesNeeded, (int)samplesLeftInSegment);
      
      if (samplesToRead > 0) {
        // Read from original position
        reader->setNextReadPosition(currentOriginalSample);
        
        juce::AudioSourceChannelInfo segmentInfo;
        segmentInfo.buffer = bufferToFill.buffer;
        segmentInfo.startSample = bufferToFill.startSample + samplesWritten;
        segmentInfo.numSamples = samplesToRead;
        
        reader->getNextAudioBlock(segmentInfo);
        
        samplesWritten += samplesToRead;
        samplesNeeded -= samplesToRead;

        // Advance edited position using duration ratio to handle gap-filled segments
        double originalTimeAdvanced = (double)samplesToRead / sampleRate;

        // Calculate the ratio between edited and original durations for this segment
        double editedDuration = segment.end - segment.start;
        double originalDuration = segment.hasOriginal() ?
          (segment.originalEnd - segment.originalStart) : segment.dur;

        // Handle potential division by zero and invalid durations
        if (originalDuration > 1e-9 && editedDuration > 1e-9) {  // Use epsilon instead of 0.0
          double durationRatio = editedDuration / originalDuration;
          // Clamp ratio to reasonable bounds to prevent overflow
          durationRatio = std::max(0.01, std::min(100.0, durationRatio));
          editedPosition += originalTimeAdvanced * durationRatio;

          // Log ratio-based advancement for debugging
          juceDLog("[JUCE] Position advanced: original=" + std::to_string(originalTimeAdvanced) +
                   "s, ratio=" + std::to_string(durationRatio) +
                   ", edited=" + std::to_string(originalTimeAdvanced * durationRatio) + "s");
        } else {
          // Fallback to original method if duration is invalid
          editedPosition += originalTimeAdvanced;
          juceDLog("[JUCE] Position advanced (fallback): " + std::to_string(originalTimeAdvanced) +
                   "s, originalDur=" + std::to_string(originalDuration) +
                   ", editedDur=" + std::to_string(editedDuration) + "s");
        }
      }
      
      // Check if we've reached the end of current segment
      if (editedPosition >= segment.end - 0.001) { // Small tolerance
        currentSegmentIndex++;
        if (currentSegmentIndex < segments.size()) {
          editedPosition = segments[currentSegmentIndex].start;
        }
      }
      
      if (samplesToRead <= 0) break; // Avoid infinite loop
    }
  }
  
  void setNextReadPosition(int64_t newPosition) override {
    // Convert sample position to edited timeline position
    editedPosition = (double)newPosition / sampleRate;
    
    // Find which segment contains this edited position
    currentSegmentIndex = 0;
    for (size_t i = 0; i < segments.size(); i++) {
      if (editedPosition >= segments[i].start && editedPosition < segments[i].end) {
        currentSegmentIndex = i;
        break;
      } else if (editedPosition < segments[i].start) {
        currentSegmentIndex = i;
        editedPosition = segments[i].start;
        break;
      }
    }
  }
  
  int64_t getNextReadPosition() const override {
    if (sampleRate <= 0.0) return 0;
    return (int64_t)(editedPosition * sampleRate);
  }
  
  int64_t getTotalLength() const override {
    if (segments.empty() || sampleRate <= 0.0) return 0;
    return (int64_t)(segments.back().end * sampleRate);
  }
  
  bool isLooping() const override { return false; }

private:
  juce::AudioFormatReaderSource* reader;
  std::vector<Segment> segments;
  bool contiguousMode = false;
  size_t currentSegmentIndex = 0;
  double editedPosition = 0.0;
  double sampleRate = 48000.0; // Default fallback, set dynamically in prepareToPlay
};

class Backend : public juce::HighResolutionTimer {
private:
  juce::AudioDeviceManager deviceManager;
  juce::AudioSourcePlayer player;
  juce::AudioFormatManager formatManager;
  juce::AudioTransportSource transportSource;
  juce::ResamplingAudioSource resampler{ &transportSource, false, 2 };
  bool useResampler { true };
  bool timerIsRunning { false };
  double playbackRate { 1.0 };
  std::unique_ptr<juce::AudioFormatReaderSource> readerSource;
  std::mutex mutex;
  std::vector<Clip> clips;
  std::vector<Segment> segments; // Flattened segments for playback (legacy compatibility)
  bool isContiguousTimeline = false;
  bool contiguousInitialized = false;
  int currentRevision = 0;
  size_t lastWordSegments = 0;
  size_t lastSpacerSegments = 0;
  // Forward declaration for use in earlier methods
  void endPlayback();
  void handleStandardTimelinePlayback();
  void handleContiguousTimelinePlayback();
  void emitPositionContiguous();

  juce::AudioSource& transportOrResampler() {
    if (useResampler) return resampler; else return transportSource;
  }

  static void emitState() { ::emitState(); }
  static void emitLoaded(double sampleRate = 48000.0, int channels = 2) { ::emitLoaded(sampleRate, channels); }
  void emitPositionFromTransport() {
    const double es = sanitizeTime(g.editedSec.load());
    const double os = sanitizeTime(editedToOriginal(es));
    emit(std::string("{") +
         "\"type\":\"position\",\"id\":\"" + g.id + "\",\"editedSec\":" + std::to_string(es) +
          ",\"originalSec\":" + std::to_string(os) + "}");
  }

  // EDL mapping helpers
  int segmentFor(double orig) const {
    const double pos = sanitizeTime(orig);
    for (size_t i = 0; i < segments.size(); ++i) {
      const auto& s = segments[i];
      const double os = s.hasOriginal() ? sanitizeTime(s.originalStart, s.start) : sanitizeTime(s.start);
      const double oe = s.hasOriginal() ? sanitizeTime(s.originalEnd, s.end) : sanitizeTime(s.end);
      const double span = sanitizeDuration(oe - os);
      if (span <= 0.0) continue;
      if (pos >= os && pos < (os + span)) return (int)i;
    }
    return -1;
  }
  double originalToEdited(double orig) const {
    if (segments.empty()) return sanitizeTime(orig);
    const double pos = sanitizeTime(orig);
    double accEdited = 0.0;
    for (const auto& s : segments) {
      const double os = s.hasOriginal() ? sanitizeTime(s.originalStart, s.start) : sanitizeTime(s.start);
      const double oe = s.hasOriginal() ? sanitizeTime(s.originalEnd, s.end) : sanitizeTime(s.end);
      const double odur = sanitizeDuration(oe - os);
      const double edur = sanitizeDuration(s.dur);
      if (odur <= 0.0 || edur <= 0.0) {
        continue;
      }
      if (pos < os) return accEdited;
      if (pos < os + odur) {
        const double r = std::clamp((pos - os) / odur, 0.0, 1.0);
        return accEdited + r * edur;
      }
      accEdited += edur;
    }
    return accEdited;
  }
  double editedToOriginal(double ed) const {
    if (segments.empty()) return sanitizeTime(ed);
    const double target = sanitizeTime(ed);
    double accEdited = 0.0;
    for (const auto& s : segments) {
      const double os = s.hasOriginal() ? sanitizeTime(s.originalStart, s.start) : sanitizeTime(s.start);
      const double oe = s.hasOriginal() ? sanitizeTime(s.originalEnd, s.end) : sanitizeTime(s.end);
      const double odur = sanitizeDuration(oe - os);
      const double edur = sanitizeDuration(s.dur);
      if (odur <= 0.0 || edur <= 0.0) {
        continue;
      }
      if (target <= accEdited + edur) {
        const double r = std::clamp((target - accEdited) / edur, 0.0, 1.0);
        return os + r * odur;
      }
      accEdited += edur;
    }
    const auto& last = segments.back();
    return last.hasOriginal() ? sanitizeTime(last.originalEnd, last.end) : sanitizeTime(last.end);
  }

public:
  Backend() {
    formatManager.registerBasicFormats();
    deviceManager.initialise(0, 2, nullptr, true);
    player.setSource(&transportOrResampler());
    deviceManager.addAudioCallback(&player);
  }
  ~Backend() override {
    stopTimer();
    player.setSource(nullptr);
    deviceManager.removeAudioCallback(&player);
    transportSource.setSource(nullptr);
  }

  void load(const std::string& id, const std::string& path) {
    std::lock_guard<std::mutex> lock(mutex);
    g.id = id;

    juceDLog(std::string("[JUCE] load() called with path: ") + path);

    // Check if file exists first
    juce::File file{ juce::String(path) };
    if (!file.exists()) {
      juceDLog("[JUCE] load() failed: file does not exist");
      emit("{\"type\":\"error\",\"message\":\"Audio file not found\"}");
      return;
    }

    juceDLog("[JUCE] Attempting to create reader for file...");
    juce::AudioFormatReader* reader = formatManager.createReaderFor(file);
    if (reader == nullptr) {
      juceDLog("[JUCE] load() failed: could not create reader for file");
      juceDLog("[JUCE] File path: " + path);
      juceDLog("[JUCE] File size: " + std::to_string(file.getSize()));
      emit("{\"type\":\"error\",\"message\":\"Failed to open audio file\"}");
      return;
    }
    juceDLog("[JUCE] Reader created successfully");
    const double sr = reader->sampleRate > 0.0 ? reader->sampleRate : 48000.0;
    const double duration = (reader->lengthInSamples > 0 && sr > 0.0)
      ? (double) reader->lengthInSamples / sr : 0.0;
    juceDLog("[JUCE] Audio info: " + std::to_string(sr) + "Hz, " + std::to_string(duration) + "s");
    readerSource.reset(new juce::AudioFormatReaderSource(reader, true));
    transportSource.setSource(readerSource.get(), 0, nullptr, sr);
    juceDLog("[JUCE] Transport source configured successfully");
    g.durationSec = sanitizeTime(duration);
    playbackRate = 1.0;
    resampler.setResamplingRatio(1.0);
    // Default EDL: single full-file segment
    segments.clear();
    if (duration > 0.0) {
      Segment fullSegment;
      fullSegment.type = "speech";
      fullSegment.start = 0.0;
      fullSegment.end = duration;
      fullSegment.dur = duration;
      segments.push_back(fullSegment);
    }
    g.editedSec = 0.0;
    g.playing = false;
    emitLoaded(sr, reader->numChannels);
    emitState();
  }

  void play() {
    std::lock_guard<std::mutex> lock(mutex);
    juceDLog("[JUCE] play() called");

    if (!readerSource) {
      juceDLog("[JUCE] play() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    transportSource.start();
    g.playing = true;
    emitState();
    if (!timerIsRunning) { startTimer(33); timerIsRunning = true; }
    juceDLog(std::string("[JUCE] Playback mode: ") + (isContiguousTimeline ? "contiguous" : "standard") +
             " timeline, revision=" + std::to_string(currentRevision) +
             ", words=" + std::to_string(lastWordSegments) +
             ", spacers=" + std::to_string(lastSpacerSegments));
  }

  void pause() {
    std::lock_guard<std::mutex> lock(mutex);

    if (!readerSource) {
      juceDLog("[JUCE] pause() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    transportSource.stop();
    g.playing = false;
    emitState();
  }

  void stop() {
    std::lock_guard<std::mutex> lock(mutex);

    if (!readerSource) {
      juceDLog("[JUCE] stop() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    transportSource.stop();
    transportSource.setPosition(0.0);
    g.editedSec = 0.0;
    g.playing = false;
    emitState();
    emitPositionFromTransport();
  }

  void seek(double editedSec) {
    std::lock_guard<std::mutex> lock(mutex);

    if (!readerSource) {
      juceDLog("[JUCE] seek() failed: no audio loaded");
      emit("{\"type\":\"error\",\"message\":\"No audio loaded\"}");
      return;
    }

    const double orig = editedToOriginal(editedSec);
    juceDLog(std::string("[JUCE] seek edited=") + std::to_string(editedSec) + " -> original=" + std::to_string(orig));
    transportSource.setPosition(orig);
    g.editedSec = editedSec;
    emitPositionFromTransport();
  }

  void setRate(double rate) {
    std::lock_guard<std::mutex> lock(mutex);
    double safeRate = std::isfinite(rate) ? rate : 1.0;
    if (safeRate <= 0.0) safeRate = 1.0;
    safeRate = std::clamp(safeRate, 0.25, 4.0);
    playbackRate = safeRate;
    resampler.setResamplingRatio(safeRate);
  }

  void setVolume(double gain) {
    std::lock_guard<std::mutex> lock(mutex);
    double safeGain = std::isfinite(gain) ? gain : 1.0;
    safeGain = std::clamp(safeGain, 0.0, 2.0);
    transportSource.setGain((float) safeGain);
  }

  void queryState() {
    std::lock_guard<std::mutex> lock(mutex);
    emitState();
    emitPositionFromTransport();
  }

  void updateEdl(std::vector<Clip> newClips, int revision) {
    std::lock_guard<std::mutex> lock(mutex);
    clips = std::move(newClips);
    currentRevision = revision;

    // Count total segments across all clips
    size_t totalSegments = 0;
    size_t spacerSegments = 0;
    size_t wordSegments = 0;
    for (const auto& clip : clips) {
      totalSegments += clip.segments.size();
      for (const auto& segment : clip.segments) {
        if (segment.type == "spacer") spacerSegments++;
        else wordSegments++;
      }
    }
    lastWordSegments = wordSegments;
    lastSpacerSegments = spacerSegments;

    {
      std::ostringstream oss;
      oss << "[JUCE] Parsed EDL revision " << revision
          << ": clips=" << clips.size()
          << ", words=" << wordSegments
          << ", spacers=" << spacerSegments
          << ", total=" << totalSegments
          << ", mode=" << (isContiguousTimeline ? "contiguous" : "standard");
      juceDLog(oss.str());
    }

    // Enhanced debug logging - write to file to see what JUCE receives
    std::ofstream debugFile(juceDebugPath(), std::ios::app);
    debugFile << "[JUCE] updateEdl received revision " << revision
              << " with " << clips.size() << " clips containing "
              << totalSegments << " segments (" << wordSegments << " words / "
              << spacerSegments << " spacers) at " << std::time(nullptr) << std::endl;
    // Log clip and segment details
    debugFile << "[JUCE] Clip details:" << std::endl;
    for (size_t c = 0; c < clips.size(); c++) {
      const auto& clip = clips[c];
      debugFile << "  [JUCE] Clip[" << c << "]: id=" << clip.id
                << ", " << clip.segments.size() << " segments ("
                << std::fixed << std::setprecision(2) << clip.duration() << "s)" << std::endl;

      // Log first few segments of each clip
      for (size_t s = 0; s < std::min(clip.segments.size(), size_t(5)); s++) {
        const auto& segment = clip.segments[s];
        debugFile << "    [JUCE] Segment[" << s << "]: "
                  << segment.type << " " << segment.start << "-" << segment.end << "s";
        if (segment.type == "word" && !segment.text.empty()) {
          debugFile << " \"" << segment.text << "\"";
        }
        debugFile << std::endl;
      }
      if (clip.segments.size() > 5) {
        debugFile << "    [JUCE] ... (" << (clip.segments.size() - 5) << " more segments)" << std::endl;
      }
    }
    debugFile.flush();

    // Detect contiguous timeline by checking if clips are perfectly aligned
    isContiguousTimeline = false;
    if (clips.size() > 1) {
      int consecutiveMatches = 0;
      for (size_t i = 1; i < clips.size() && i < 5; i++) {
        double gap = clips[i].startSec - clips[i-1].endSec;
        if (std::abs(gap) < 0.01) { // 10ms tolerance
          consecutiveMatches++;
        }
      }

      if (consecutiveMatches >= 2) {
        isContiguousTimeline = true;
        debugFile << "[JUCE] CONTIGUOUS TIMELINE DETECTED for revision " << revision << std::endl;
      } else {
        debugFile << "[JUCE] Standard timeline (gap matches: " << consecutiveMatches << ") for revision " << revision << std::endl;
      }
    }

    // Reset initialization for contiguous timeline
    if (isContiguousTimeline) {
      contiguousInitialized = false;
    }

    // Create flattened segments array for playback
    segments.clear();
    for (const auto& clip : clips) {
      const double clipTimelineStart = sanitizeTime(clip.startSec);
      const double clipTimelineEnd = sanitizeTime(clip.endSec, clipTimelineStart);
      const double clipTimelineDur = sanitizeDuration(clipTimelineEnd - clipTimelineStart);
      if (clipTimelineDur <= 0.0) {
        debugFile << "[JUCE] Skipping clip with invalid duration: " << clip.id << std::endl;
        continue;
      }

      const bool clipHasOriginal = clip.hasOriginal();
      const double clipOriginalStart = clipHasOriginal ? sanitizeTime(clip.originalStartSec, clipTimelineStart) : 0.0;
      const double clipOriginalEnd = clipHasOriginal ? sanitizeTime(clip.originalEndSec, clipOriginalStart) : 0.0;
      const double clipOriginalDur = clipHasOriginal ? sanitizeDuration(clipOriginalEnd - clipOriginalStart) : 0.0;

      for (const auto& seg : clip.segments) {
        const double segDur = sanitizeDuration(seg.dur);
        if (segDur <= 0.0) {
          continue;
        }

        Segment flatSeg;
        flatSeg.type = seg.type;
        flatSeg.text = seg.text;

        const double segStartTimeline = sanitizeTime(clipTimelineStart + seg.start, clipTimelineStart);
        const double segEndTimeline = sanitizeTime(segStartTimeline + segDur, segStartTimeline + segDur);
        const double segTimelineDur = sanitizeDuration(segEndTimeline - segStartTimeline);
        if (segTimelineDur <= 0.0) {
          continue;
        }

        flatSeg.start = segStartTimeline;
        flatSeg.end = segStartTimeline + segTimelineDur;
        flatSeg.dur = segTimelineDur;

        if (seg.hasOriginal()) {
          const double segOrigStart = sanitizeTime(seg.originalStart, segStartTimeline);
          const double segOrigEnd = sanitizeTime(seg.originalEnd, segOrigStart);
          const double segOrigDur = sanitizeDuration(segOrigEnd - segOrigStart);
          if (segOrigDur > 0.0) {
            flatSeg.originalStart = segOrigStart;
            flatSeg.originalEnd = segOrigStart + segOrigDur;
          } else {
            flatSeg.originalStart = segStartTimeline;
            flatSeg.originalEnd = segEndTimeline;
          }
        } else if (clipHasOriginal && clipOriginalDur > 0.0) {
          const double ratio = std::min(1.0, std::max(0.0, seg.start / clipTimelineDur));
          const double mappedStart = clipOriginalStart + ratio * clipOriginalDur;
          flatSeg.originalStart = sanitizeTime(mappedStart, clipOriginalStart);
          flatSeg.originalEnd = sanitizeTime(flatSeg.originalStart + segTimelineDur, flatSeg.originalStart + segTimelineDur);
        } else {
          flatSeg.originalStart = segStartTimeline;
          flatSeg.originalEnd = segEndTimeline;
        }

        if (sanitizeDuration(flatSeg.originalEnd - flatSeg.originalStart) <= 0.0) {
          flatSeg.originalStart = segStartTimeline;
          flatSeg.originalEnd = segEndTimeline;
        }

        segments.push_back(flatSeg);
      }
    }

    if (!segments.empty()) {
      std::sort(segments.begin(), segments.end(), [](const Segment& a, const Segment& b) {
        if (a.start == b.start) return a.end < b.end;
        return a.start < b.start;
      });
    }

    debugFile << "[JUCE] Created " << segments.size() << " flattened segments for playback" << std::endl;

    // Safety check: Verify we have segments before enabling contiguous mode
    if (isContiguousTimeline && segments.empty()) {
      debugFile << "[JUCE] WARNING: Contiguous timeline detected but no segments received" << std::endl;
      debugFile << "[JUCE] Falling back to standard timeline mode" << std::endl;
      isContiguousTimeline = false;

      // Create a default full-file segment to prevent playback failure
      if (g.durationSec > 0) {
        Segment fullSegment;
        fullSegment.type = "speech";
        fullSegment.start = 0.0;
        fullSegment.end = g.durationSec;
        fullSegment.dur = g.durationSec;
        fullSegment.originalStart = 0.0;
        fullSegment.originalEnd = g.durationSec;
        segments.push_back(fullSegment);
        debugFile << "[JUCE] Created fallback full-file segment: 0.0-" << g.durationSec << "s" << std::endl;
      }
    }

    const std::string mode = isContiguousTimeline ? "contiguous" : "standard";

    debugFile << "[JUCE] updateEdl segment breakdown complete for revision " << revision
              << ", mode=" << mode << std::endl;
    debugFile.flush();

    {
      std::ostringstream evt;
      evt << "{\"type\":\"edlApplied\",\"id\":\"" << g.id << "\",\"revision\":" << revision
          << ",\"wordCount\":" << wordSegments
          << ",\"spacerCount\":" << spacerSegments
          << ",\"totalSegments\":" << totalSegments
          << ",\"mode\":\"" << mode << "\"}";
      emit(evt.str());
    }
  }

  void hiResTimerCallback() override {
    std::lock_guard<std::mutex> lock(mutex);
    if (!g.playing) return;
    
    // With edited/original mapping fixed, both modes operate correctly.
    // Prefer contiguous handler if detected, else standard.
    if (isContiguousTimeline) handleContiguousTimelinePlayback();
    else handleStandardTimelinePlayback();
  }
  
};

// ---- Out-of-class definitions for complex methods ----
void Backend::endPlayback() {
  transportSource.stop();
  g.playing = false;
  emit("{\"type\":\"ended\",\"id\":\"" + g.id + "\"}");
}

void Backend::handleStandardTimelinePlayback() {
  double pos = sanitizeTime(transportSource.getCurrentPosition()); // original domain
  {
    std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
    oss << "[JUCE][STD] pos=" << pos;
    if (!segments.empty()) {
      const auto& s0 = segments[0];
      const double os0 = s0.hasOriginal() ? s0.originalStart : s0.start;
      const double oe0 = s0.hasOriginal() ? s0.originalEnd   : s0.end;
      oss << " firstOrig=" << os0 << "-" << oe0;
    }
    juceDLog(oss.str());
  }

  if (!segments.empty()) {
    // Robustly advance across any number of boundaries with loop protection
    int loopCount = 0;
    const int maxLoops = 10; // Prevent infinite loops

    while (loopCount < maxLoops) {
      loopCount++;
      int segIdx = segmentFor(pos);

      if (segIdx < 0) {
        // Position is not in any segment
        {
          const double firstOs = segments.front().hasOriginal()
            ? sanitizeTime(segments.front().originalStart, segments.front().start)
            : sanitizeTime(segments.front().start);
          const double firstOe = segments.front().hasOriginal()
            ? sanitizeTime(segments.front().originalEnd, segments.front().end)
            : sanitizeTime(segments.front().end, firstOs);
          if (pos < firstOs) {
            // Before first segment - jump to first segment start
            double newPos = firstOs;
            transportSource.setPosition(newPos);
            pos = newPos;
            {
              std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
              oss << "[JUCE][STD] Jump to first os=" << pos;
              juceDLog(oss.str());
            }
            continue;
          } else {
            // After last segment - find which segment to jump to or end
            bool foundNext = false;
            for (size_t i = 0; i < segments.size(); ++i) {
              const double os = segments[i].hasOriginal()
                ? sanitizeTime(segments[i].originalStart, segments[i].start)
                : sanitizeTime(segments[i].start);
              if (pos < os) {
                // Found a segment that starts after our position
                double newPos = os;
                transportSource.setPosition(newPos);
                pos = newPos;
                foundNext = true;
                {
                  std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
                  oss << "[JUCE][STD] Jump to next idx=" << i << " os=" << pos;
                  juceDLog(oss.str());
                }
                break;
              }
            }
            if (!foundNext) {
              // No more segments ahead - end playback
              endPlayback();
              return;
            }
            continue;
          }
        }

        // Position is within a segment
        const auto& s = segments[segIdx];
        {
          const double se = s.hasOriginal()
            ? sanitizeTime(s.originalEnd, s.end)
            : sanitizeTime(s.end);
          if (pos >= se - 1e-6) {
            // At or past end of current segment
            if (segIdx + 1 < (int)segments.size()) {
              // Jump to next segment
              const auto& sn = segments[segIdx + 1];
              double newPos = sn.hasOriginal()
                ? sanitizeTime(sn.originalStart, sn.start)
                : sanitizeTime(sn.start);
              transportSource.setPosition(newPos);
              pos = newPos;
              {
                std::ostringstream oss; oss.setf(std::ios::fixed); oss << std::setprecision(3);
                oss << "[JUCE][STD] Boundary advance to idx=" << (segIdx+1) << " os=" << pos;
                juceDLog(oss.str());
              }
              continue;
            } else {
              // No more segments - end playback
              endPlayback();
              return;
            }
          }

          // Position is valid within current segment - exit loop
          break;
        }
      }

      if (loopCount >= maxLoops) {
        if (const char* debug = getenv("VITE_AUDIO_DEBUG")) {
          if (strcmp(debug, "true") == 0) {
            std::cerr << "[JUCE] Loop limit reached in boundary handling" << std::endl;
          }
        }
        // Fallback: end playback to prevent infinite loop
        endPlayback();
        return;
      }
    }
  } else if (pos >= g.durationSec) {
    endPlayback();
    return;
  }

  g.editedSec = originalToEdited(pos);
  emitPositionFromTransport();
}

void Backend::handleContiguousTimelinePlayback() {
  double pos = sanitizeTime(transportSource.getCurrentPosition()); // original audio time

  // Safety check for segments
  if (segments.empty()) {
    juceDLog("[JUCE] CONTIGUOUS: No segments available");
    endPlayback();
    return;
  }

  if (!contiguousInitialized && !segments.empty() && segments[0].hasOriginal()) {
    // Initialize to the current edited position's corresponding original time,
    // to respect any user seek that happened just before playback.
    const double targetOrig = sanitizeTime(editedToOriginal(g.editedSec.load()));
    transportSource.setPosition(targetOrig);
    contiguousInitialized = true;

    std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
    debugFile << "[JUCE] CONTIGUOUS: Initialized at edited=" << g.editedSec.load() << " -> orig=" << targetOrig << std::endl;
    debugFile.flush();

    emitPositionFromTransport();
    return; // Avoid using stale 'pos' from before setPosition
  }

  // Find which segment we're currently playing (by original position)
  int segIdx = -1;
  for (size_t i = 0; i < segments.size(); i++) {
    // Bounds check before accessing segment
    if (i >= segments.size()) {
      juceDLog("[JUCE] CONTIGUOUS: Segment index out of bounds: " + std::to_string(i));
      break;
    }

    const auto& seg = segments[i];
    if (seg.hasOriginal()) {
      const double oStart = sanitizeTime(seg.originalStart, seg.start);
      const double oEnd = sanitizeTime(seg.originalEnd, seg.end);
      const double oDur = sanitizeDuration(oEnd - oStart);
      if (oDur <= 0.0) {
        continue;
      }
      if (pos >= oStart && pos < oStart + oDur) {
        segIdx = (int)i;
        break;
      }
    }
  }

  if (segIdx >= 0) {
    // We're in a valid segment - calculate contiguous time position
    const auto& seg = segments[segIdx];
    const double oStart = sanitizeTime(seg.originalStart, seg.start);
    const double oEnd = sanitizeTime(seg.originalEnd, seg.end);
    const double oDur = sanitizeDuration(oEnd - oStart);
    if (oDur <= 0.0) {
      endPlayback();
      return;
    }

    const double cStart = sanitizeTime(seg.start);
    const double cEnd = sanitizeTime(seg.end, cStart);
    const double cDur = sanitizeDuration(cEnd - cStart);
    if (cDur <= 0.0) {
      endPlayback();
      return;
    }

    const double relativePos = std::clamp((pos - oStart) / oDur, 0.0, 1.0);
    const double contiguousTime = cStart + relativePos * cDur;
    g.editedSec.store(contiguousTime);

    // Check if we're near the end of current segment
    if (pos >= oStart + oDur - 0.05) { // 50ms tolerance
      if (segIdx + 1 < (int)segments.size() && segments[segIdx + 1].hasOriginal()) {
        // Jump to next reordered segment's original position
        double nextOriginalStart = sanitizeTime(segments[segIdx + 1].originalStart, segments[segIdx + 1].start);
        transportSource.setPosition(nextOriginalStart);

        std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
        debugFile << "[JUCE] CONTIGUOUS: Advanced to segment " << (segIdx + 1)
                  << " orig=" << nextOriginalStart << std::endl;
        debugFile.flush();
      } else {
        // No more segments - end playback
        endPlayback();
        return;
      }
    }
  } else {
    // Not in any segment - find next segment or end
    bool foundNext = false;
    for (size_t i = 0; i < segments.size(); i++) {
      if (!segments[i].hasOriginal()) continue;
      const double nextOrigStart = sanitizeTime(segments[i].originalStart, segments[i].start);
      if (pos < nextOrigStart) {
        transportSource.setPosition(nextOrigStart);
        g.editedSec.store(sanitizeTime(segments[i].start));
        foundNext = true;

        std::ofstream debugFile("/tmp/juce_debug.log", std::ios::app);
        debugFile << "[JUCE] CONTIGUOUS: Jumped to segment " << i
                  << " orig=" << nextOrigStart << std::endl;
        debugFile.flush();
        break;
      }
    }

    if (!foundNext) {
      endPlayback();
      return;
    }
  }

  emitPositionFromTransport();
}

void Backend::emitPositionContiguous() {
  // For contiguous timeline, editedSec is correct, but we need to calculate originalSec
  const double es = g.editedSec.load();
  double os = es; // Default fallback

  // Find which contiguous segment we're in
  for (size_t i = 0; i < segments.size(); i++) {
    if (es >= segments[i].start && es < segments[i].end) {
      // We're in segment i - but segments[i] contains contiguous times
      // We need to reverse-engineer what original time this corresponds to
      // For now, we'll use a placeholder approach
      os = es; // This needs proper mapping - will be improved next
      break;
    }
  }

  emit(std::string("{") +
       "\"type\":\"position\",\"id\":\"" + g.id + "\",\"editedSec\":" + std::to_string(es) +
       ",\"originalSec\":" + std::to_string(os) + "}");
}

#endif // USE_JUCE

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

  // Increase stdin buffer size to handle large EDL payloads
  constexpr size_t BUFFER_SIZE = 1024 * 1024; // 1MB buffer
  static std::unique_ptr<char[]> stdinBuffer(new char[BUFFER_SIZE]);
  if (auto* buf = std::cin.rdbuf()) {
    buf->pubsetbuf(stdinBuffer.get(), BUFFER_SIZE);
  }

  juceDLog("[JUCE] Main process starting with enhanced stdin buffer (1MB)...");

#ifdef USE_JUCE
  Backend backend;
#else
  std::thread t(timerThread);
#endif

  std::string line;
  while (std::getline(std::cin, line)) {
    if (line.empty()) continue;
#ifdef USE_JUCE
    // Minimal command router for JUCE backend
    auto contains = [&](const char* s) { return line.find(s) != std::string::npos; };
    auto extract = [&](const char* key) -> std::string {
      std::string k = std::string("\"") + key + "\":";
      size_t p = line.find(k);
      if (p == std::string::npos) return {};
      p += k.size();
      if (p >= line.size()) return {};
      if (line[p] == '"') { size_t end = line.find('"', p + 1); if (end == std::string::npos) return {}; return line.substr(p + 1, end - (p + 1)); }
      size_t end = line.find_first_of(",}\n", p); if (end == std::string::npos) end = line.size(); return line.substr(p, end - p);
    };

    if (contains("\"type\":\"load\"")) {
      g.id = extract("id");
      backend.load(g.id, extract("path"));
      continue;
    }
    if (contains("\"type\":\"updateEdlFromFile\"")) {
      std::string pathValue = extract("path");
      if (pathValue.empty()) {
        emit("{\"type\":\"error\",\"message\":\"Missing EDL file path\"}");
        continue;
      }

      std::ifstream edlFile(pathValue);
      if (!edlFile.good()) {
        emit("{\"type\":\"error\",\"message\":\"Unable to read EDL file\"}");
        continue;
      }

      std::stringstream buffer;
      buffer << edlFile.rdbuf();
      edlFile.close();

      std::vector<Clip> clips;
      int revision = 0;
      if (!parseClipsFromJsonPayload(buffer.str(), clips, &revision)) {
        emit("{\"type\":\"error\",\"message\":\"Invalid EDL file contents\"}");
        continue;
      }

      backend.updateEdl(std::move(clips), revision);
      std::remove(pathValue.c_str());
      continue;
    }

    if (contains("\"type\":\"updateEdl\"")) {
      std::vector<Clip> clips;
      int revision = 0;
      if (!parseClipsFromJsonPayload(line, clips, &revision)) {
        emit("{\"type\":\"error\",\"message\":\"Invalid EDL payload\"}");
        continue;
      }

      backend.updateEdl(std::move(clips), revision);
      continue;
    }
    if (contains("\"type\":\"play\"")) { backend.play(); continue; }
    if (contains("\"type\":\"pause\"")) { backend.pause(); continue; }
    if (contains("\"type\":\"stop\"")) { backend.stop(); continue; }
    if (contains("\"type\":\"seek\"")) { try { backend.seek(std::stod(extract("timeSec"))); } catch (...) {} continue; }
    if (contains("\"type\":\"setRate\"")) { try { backend.setRate(std::stod(extract("rate"))); } catch (...) {} continue; }
    if (contains("\"type\":\"setVolume\"")) { try { backend.setVolume(std::stod(extract("value"))); } catch (...) {} continue; }
    if (contains("\"type\":\"queryState\"")) { backend.queryState(); continue; }
    // updateEdl ignored for now (full-file playback)
    // unrecognized
    emit("{\"type\":\"error\",\"message\":\"unknown command\"}");
#else
    handleLine(line);
#endif
  }

#ifndef USE_JUCE
  g.running = false;
  t.join();
#endif
  return 0;
}
