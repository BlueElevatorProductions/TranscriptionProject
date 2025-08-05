# Next Steps for TranscriptionProject

## Current Status
We've successfully implemented the foundation of the ScriptScribe-inspired design system:
- ✅ Removed ChakraProvider and migrated to Tailwind CSS v3
- ✅ Created shadcn/ui component library (Button, Card, Dialog, Slider, etc.)
- ✅ Implemented HSL-based color tokens and theme system
- ✅ Updated main app header and home view with new design
- ✅ Preserved keyboard shortcuts hook from Development Preview
- ✅ Removed Development Preview to avoid confusion

## Immediate Priorities

### 1. **Listen vs Edit Mode Differentiation** (HIGH)
From the Development Preview, we identified this as the key feature to preserve:
- Add mode state to the main app
- Create distinct UI behaviors for each mode
- Listen mode: Read-only, focused on playback
- Edit mode: Full editing capabilities with toolbar

### 2. **Update BottomAudioPlayer Component** (HIGH)
- Replace Chakra UI components with shadcn/ui Slider and Button
- Apply new design tokens and styling
- Ensure consistent appearance with the rest of the app

### 3. **Update Modal Components** (MEDIUM)
- Replace Chakra modals with shadcn/ui Dialog component
- Update ImportDialog, ProjectImportDialog, ApiSettings, etc.
- Maintain functionality while improving visual consistency

### 4. **Implement Keyboard Shortcuts** (MEDIUM)
We've created `useKeyboardShortcuts.ts` but haven't integrated it yet:
- Space: Play/Pause
- P: Toggle panels (future)
- Shift+P: Toggle audio player
- Cmd/Ctrl+S: Save project
- Cmd/Ctrl+O: Open project
- Cmd/Ctrl+N: New project

### 5. **Complete Phase 3-5 of Design Implementation** (MEDIUM)
- Phase 3: Update remaining layout components
- Phase 4: Forms and input components
- Phase 5: Final polish and consistency check

## Technical Debt to Address
1. Fix TypeScript errors in test files (react-hooks version mismatch)
2. Remove unused Chakra UI imports throughout the codebase
3. Update component documentation to reflect new design system

## Future Enhancements
1. Resizable panels (from Dev Preview concept)
2. Floating toolbar for text formatting
3. Advanced layout management
4. Animation system with Framer Motion

## Development Workflow
1. Test each component update thoroughly
2. Maintain backward compatibility where possible
3. Update documentation as we go
4. Keep bundle size optimized

## Notes
- The main value from the Development Preview was the concept of Listen vs Edit modes
- We're implementing the ScriptScribe design in the main app, not the Google Docs design
- Focus on functionality first, polish second
- Keep the user experience consistent throughout the migration