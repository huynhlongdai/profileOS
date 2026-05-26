/**
 * Browser Recorder Script
 * This script is injected into the browser to record user actions
 */

export const RECORDER_SCRIPT = `
(function() {
  if (window.__gpmRecorder) {
    console.log('[Recorder] Already initialized');
    return;
  }

  const recorder = {
    isRecording: false,
    recordingId: null,
    actions: [],
    sessionId: Date.now().toString(),
    
    // Drag and drop tracking
    dragStart: null,
    lastHoverTarget: null,
    hoverTimeout: null,
    
    // Start recording
    start(recordingId) {
      this.recordingId = recordingId;
      this.isRecording = true;
      this.actions = [];
      this.attachListeners();
      console.log('[Recorder] Started recording:', recordingId);
      this.showRecordingIndicator();
    },
    
    // Stop recording
    stop() {
      this.isRecording = false;
      this.detachListeners();
      this.hideRecordingIndicator();
      console.log('[Recorder] Stopped recording. Total actions:', this.actions.length);
      return this.actions;
    },
    
    // Attach event listeners
    attachListeners() {
      // Existing listeners
      document.addEventListener('click', this.handleClick, true);
      document.addEventListener('input', this.handleInput, true);
      document.addEventListener('change', this.handleChange, true);
      document.addEventListener('keydown', this.handleKeydown, true);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      // New Tier 1 listeners
      document.addEventListener('dblclick', this.handleDoubleClick, true);
      document.addEventListener('contextmenu', this.handleRightClick, true);
      document.addEventListener('mouseover', this.handleMouseOver, true);
      document.addEventListener('mousedown', this.handleMouseDown, true);
      document.addEventListener('mouseup', this.handleMouseUp, true);
    },
    
    // Detach event listeners
    detachListeners() {
      // Existing listeners
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('input', this.handleInput, true);
      document.removeEventListener('change', this.handleChange, true);
      document.removeEventListener('keydown', this.handleKeydown, true);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      
      // New Tier 1 listeners
      document.removeEventListener('dblclick', this.handleDoubleClick, true);
      document.removeEventListener('contextmenu', this.handleRightClick, true);
      document.removeEventListener('mouseover', this.handleMouseOver, true);
      document.removeEventListener('mousedown', this.handleMouseDown, true);
      document.removeEventListener('mouseup', this.handleMouseUp, true);
    },
    
    // Handle click events
    handleClick(e) {
      if (!recorder.isRecording) return;
      
      // Ignore clicks on recorder UI
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      const action = {
        id: \`\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        type: 'click',
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        xpath: recorder.getXPath(e.target),
        text: e.target.innerText?.substring(0, 100),
        url: window.location.href,
        title: document.title,
        coordinates: { x: e.clientX, y: e.clientY },
        metadata: {
          tagName: e.target.tagName,
          attributes: recorder.getAttributes(e.target),
          innerText: e.target.innerText?.substring(0, 200),
        },
      };
      
      recorder.addAction(action);
    },
    
    // Handle input events
    handleInput(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      const action = {
        id: \`\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        type: 'input',
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        xpath: recorder.getXPath(e.target),
        value: e.target.value,
        url: window.location.href,
        title: document.title,
        metadata: {
          tagName: e.target.tagName,
          attributes: recorder.getAttributes(e.target),
          inputType: e.target.type,
        },
      };
      
      recorder.addAction(action);
    },
    
    // Handle change events (for select, checkbox, radio)
    handleChange(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      const action = {
        id: \`\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        type: 'select',
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        xpath: recorder.getXPath(e.target),
        value: e.target.value,
        url: window.location.href,
        title: document.title,
        metadata: {
          tagName: e.target.tagName,
          attributes: recorder.getAttributes(e.target),
          selectedIndex: e.target.selectedIndex,
        },
      };
      
      recorder.addAction(action);
    },
    
    // Handle keydown events
    handleKeydown(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      // Only record special keys (Enter, Tab, Escape, etc.)
      const specialKeys = ['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!specialKeys.includes(e.key)) return;
      
      const action = {
        id: \`\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        type: 'keypress',
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        key: e.key,
        url: window.location.href,
        title: document.title,
        metadata: {
          tagName: e.target.tagName,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        },
      };
      
      recorder.addAction(action);
    },
    
    // Handle double-click events (Tier 1)
    handleDoubleClick(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      // Prevent default click from also being recorded
      e.stopImmediatePropagation();
      
      const action = {
        id: \`\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        type: 'doubleClick',
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        xpath: recorder.getXPath(e.target),
        text: e.target.innerText?.substring(0, 100),
        url: window.location.href,
        title: document.title,
        coordinates: { x: e.clientX, y: e.clientY },
        metadata: {
          tagName: e.target.tagName,
          attributes: recorder.getAttributes(e.target),
        },
      };
      
      recorder.addAction(action);
    },
    
    // Handle right-click events (Tier 1)
    handleRightClick(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      const action = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        type: 'rightClick',
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        xpath: recorder.getXPath(e.target),
        text: e.target.innerText?.substring(0, 100),
        url: window.location.href,
        title: document.title,
        coordinates: { x: e.clientX, y: e.clientY },
        metadata: {
          tagName: e.target.tagName,
          attributes: recorder.getAttributes(e.target),
        },
      };
      
      recorder.addAction(action);
    },
    
    // Handle mouse over events for hover (Tier 1)
    handleMouseOver(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      // Debounce hover events - only record if hovering for >500ms
      if (recorder.hoverTimeout) {
        clearTimeout(recorder.hoverTimeout);
      }
      
      const target = e.target;
      recorder.hoverTimeout = setTimeout(() => {
        // Only record meaningful hovers (triggers dropdown, tooltip, etc.)
        // Check if element has title, aria-label, or is interactive
        const isInteractive = target.hasAttribute('title') || 
                              target.hasAttribute('aria-label') ||
                              target.matches('a, button, [role="button"], [onclick]');
        
        if (!isInteractive) return;
        
        const action = {
          id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          type: 'hover',
          timestamp: Date.now(),
          selector: recorder.getSelector(target),
          xpath: recorder.getXPath(target),
          text: target.innerText?.substring(0, 100),
          url: window.location.href,
          title: document.title,
          coordinates: { x: e.clientX, y: e.clientY },
          metadata: {
            tagName: target.tagName,
            attributes: recorder.getAttributes(target),
            hasTitle: target.hasAttribute('title'),
          },
        };
        
        recorder.addAction(action);
      }, 500);
    },
    
    // Handle mouse down for drag detection (Tier 1)
    handleMouseDown(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      // Track potential drag start
      recorder.dragStart = {
        target: e.target,
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        selector: recorder.getSelector(e.target),
        xpath: recorder.getXPath(e.target),
      };
    },
    
    // Handle mouse up for drag detection (Tier 1)
    handleMouseUp(e) {
      if (!recorder.isRecording) return;
      if (e.target.closest('#gpm-recorder-indicator')) return;
      
      // Check if this was a drag operation
      if (recorder.dragStart) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - recorder.dragStart.x, 2) +
          Math.pow(e.clientY - recorder.dragStart.y, 2)
        );
        
        const duration = Date.now() - recorder.dragStart.timestamp;
        
        // Consider it a drag if moved >50px and duration >200ms
        if (distance > 50 && duration > 200) {
          const action = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: 'dragAndDrop',
            timestamp: Date.now(),
            selector: recorder.dragStart.selector,
            xpath: recorder.dragStart.xpath,
            fromCoordinates: { x: recorder.dragStart.x, y: recorder.dragStart.y },
            toCoordinates: { x: e.clientX, y: e.clientY },
            url: window.location.href,
            title: document.title,
            metadata: {
              distance: Math.round(distance),
              duration: duration,
              fromElement: recorder.dragStart.target.tagName,
              toElement: e.target.tagName,
            },
          };
          
          recorder.addAction(action);
        }
        
        // Reset drag tracking
        recorder.dragStart = null;
      }
    },
    
    // Handle page unload
    handleBeforeUnload(e) {
      if (recorder.isRecording) {
        const action = {
          id: \`\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
          type: 'navigate',
          timestamp: Date.now(),
          url: window.location.href,
          title: document.title,
        };
        recorder.addAction(action);
      }
    },
    
    // Add action to list and send to backend
    addAction(action) {
      this.actions.push(action);
      this.updateIndicator(this.actions.length);
      
      // Send to backend
      this.sendToBackend(action);
    },
    
    // Send action to backend
    sendToBackend(action) {
      if (!this.recordingId) return;
      
      fetch('/api/automation/recordings/' + this.recordingId + '/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      }).catch(err => {
        console.error('[Recorder] Failed to send action:', err);
      });
    },
    
    // Generate CSS selector
    getSelector(element) {
      if (element.id) {
        return '#' + element.id;
      }
      
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c && !c.startsWith('_')).join('.');
        if (classes) {
          return element.tagName.toLowerCase() + '.' + classes;
        }
      }
      
      // Use nth-child
      let path = [];
      let current = element;
      while (current && current.tagName) {
        let selector = current.tagName.toLowerCase();
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children);
          const index = siblings.indexOf(current) + 1;
          selector += ':nth-child(' + index + ')';
        }
        path.unshift(selector);
        current = current.parentElement;
        if (path.length > 5) break; // Limit depth
      }
      return path.join(' > ');
    },
    
    // Generate XPath
    getXPath(element) {
      if (element.id) {
        return '//*[@id="' + element.id + '"]';
      }
      
      const paths = [];
      let current = element;
      while (current && current.tagName) {
        let index = 0;
        let sibling = current.previousSibling;
        while (sibling) {
          if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = current.tagName.toLowerCase();
        const pathIndex = index > 0 ? '[' + (index + 1) + ']' : '';
        paths.unshift(tagName + pathIndex);
        current = current.parentElement;
        if (paths.length > 5) break;
      }
      return '//' + paths.join('/');
    },
    
    // Get element attributes
    getAttributes(element) {
      const attrs = {};
      if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          attrs[attr.name] = attr.value;
        }
      }
      return attrs;
    },
    
    // Show recording indicator
    showRecordingIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'gpm-recorder-indicator';
      indicator.innerHTML = \`
        <div style="
          position: fixed;
          top: 10px;
          right: 10px;
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 600;
          z-index: 999999;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
          "></span>
          <span>Recording</span>
          <span id="gpm-recorder-count" style="
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
          ">0</span>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        </style>
      \`;
      document.body.appendChild(indicator);
    },
    
    // Update indicator count
    updateIndicator(count) {
      const countEl = document.getElementById('gpm-recorder-count');
      if (countEl) {
        countEl.textContent = count;
      }
    },
    
    // Hide recording indicator
    hideRecordingIndicator() {
      const indicator = document.getElementById('gpm-recorder-indicator');
      if (indicator) {
        indicator.remove();
      }
    },
  };
  
  window.__gpmRecorder = recorder;
  console.log('[Recorder] Initialized');
})();
`;
