// popup.js
document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    chrome.storage.sync.get(['language', 'interval'], function(items) {
      if (items.language) {
        document.getElementById('language').value = items.language;
      }
      if (items.interval) {
        document.getElementById('interval').value = items.interval;
      }
    });
    
    // Save settings when changed
    document.getElementById('language').addEventListener('change', function() {
      chrome.storage.sync.set({ 'language': this.value });
    });
    
    document.getElementById('interval').addEventListener('change', function() {
      chrome.storage.sync.set({ 'interval': this.value });
    });
    
    // Start practice mode
    document.getElementById('start-practice').addEventListener('click', function() {
      // Save current settings
      const language = document.getElementById('language').value;
      const interval = document.getElementById('interval').value;
      
      chrome.storage.sync.set({
        'language': language,
        'interval': interval,
        'practiceMode': true
      }, function() {
        // Update status
        document.getElementById('status-message').textContent = 'Practice mode activated!';
        document.getElementById('status-message').style.backgroundColor = '#e6f7e9';
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'startPractice',
            language,
            interval
          });
        });
      });
    });
    
    // Stop practice mode
    document.getElementById('stop-practice').addEventListener('click', function() {
      chrome.storage.sync.set({ 'practiceMode': false }, function() {
        // Update status
        document.getElementById('status-message').textContent = 'Practice mode deactivated.';
        document.getElementById('status-message').style.backgroundColor = '#f8f8f8';
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'stopPractice' });
        });
      });
    });
  });