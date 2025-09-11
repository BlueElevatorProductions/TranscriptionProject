cmake_minimum_required(VERSION 3.15)
project(juce-backend LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(USE_JUCE "Build with JUCE engine" OFF)

add_executable(juce-backend src/main.cpp)

if (USE_JUCE)
  # Expect JUCE provided via JUCE_DIR environment variable or cache var
  if (NOT DEFINED JUCE_DIR)
    if (DEFINED ENV{JUCE_DIR})
      set(JUCE_DIR $ENV{JUCE_DIR})
    endif()
  endif()

  # Support both JUCE source tree and installed CMake package
  if (JUCE_DIR AND EXISTS "${JUCE_DIR}/CMakeLists.txt")
    message(STATUS "Using JUCE source: ${JUCE_DIR}")
    add_subdirectory("${JUCE_DIR}" JUCE)
    target_link_libraries(juce-backend PRIVATE juce::juce_audio_utils juce::juce_audio_devices juce::juce_audio_basics juce::juce_core)
    target_compile_definitions(juce-backend PRIVATE USE_JUCE=1)
  else()
    # Try find_package using JUCE_DIR as a hint if provided
    if (JUCE_DIR)
      list(APPEND CMAKE_PREFIX_PATH "${JUCE_DIR}")
    endif()
    find_package(JUCE CONFIG)
    if (JUCE_FOUND)
      message(STATUS "Found JUCE package: ${JUCE_VERSION}")
      target_link_libraries(juce-backend PRIVATE juce::juce_audio_utils juce::juce_audio_devices juce::juce_audio_basics juce::juce_core)
      target_compile_definitions(juce-backend PRIVATE USE_JUCE=1)
    else()
      message(FATAL_ERROR "USE_JUCE=ON but JUCE not found. Set JUCE_DIR to JUCE source or CMake package path, or install JUCE (e.g., Homebrew).")
    endif()
  endif()
endif()

if(APPLE)
  set_target_properties(juce-backend PROPERTIES OUTPUT_NAME "juce-backend")
elseif(WIN32)
  set_target_properties(juce-backend PROPERTIES OUTPUT_NAME "juce-backend")
else()
  set_target_properties(juce-backend PROPERTIES OUTPUT_NAME "juce-backend")
endif()
