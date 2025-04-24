(function() {
    'use strict';

    let selectedResults = []; // Array to track selected results

    function isPortrait() {
        return window.matchMedia('(orientation: portrait)').matches;
      }

    function monitorOrientation() {
    const sidebar = document.getElementById('transcriptSidebar');
    const controls = document.getElementById('transcriptSidebarControls');
    if (!sidebar) return;

    if (isPortrait()) {
        // Portrait mode: sidebar at the bottom
        sidebar.style.top = '';
        sidebar.style.left = '';
        sidebar.style.width = '';
        sidebar.style.height = '50%';
        sidebar.style.bottom = '0';
        sidebar.style.overflowY = 'auto';
        controls.style.top = '-20px';
        sidebar.style.borderTop = '1px solid #ccc';
        sidebar.style.borderRight = '';

        // Add a spacer at the bottom of the content
        let spacer = document.getElementById('content-bottom-spacer');
        if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = 'content-bottom-spacer';
        spacer.style.height = '1080px'; // Equal to sidebar height
        document.body.appendChild(spacer);
        }
        // Remove margin-right to wrapper (if created)
        const pageWrapper = document.getElementById('page-wrapper');
        pageWrapper.style.transform = ''; // Reset position when sidebar is hidden
        pageWrapper.style.width = '100%';

    } else {
        // Landscape mode: sidebar on the right side
        sidebar.style.bottom = '';
        sidebar.style.top = '-11px';
        sidebar.style.left = '0';
        sidebar.style.width = '440px';
        sidebar.style.height = '100%';
        sidebar.style.overflowY = 'auto';
        controls.style.top = '-9px';
        sidebar.style.borderTop = '';
        sidebar.style.borderRight = '1px solid #ccc';

        // Remove the spacer when in landscape mode
        const spacer = document.getElementById('content-bottom-spacer');
        if (spacer) spacer.remove();

        // Apply margin-right to wrapper (if created)
        const pageWrapper = document.getElementById('page-wrapper');
        const isSidebarVisible = sidebar.style.display !== 'none';
        if (isSidebarVisible) {
            pageWrapper.style.transform = 'translateX(440px)'; // Move the page content to the left by sidebar width
            pageWrapper.style.width = 'calc(100% - 440px)'; // Move the page content to the left by sidebar width
        } else {
            pageWrapper.style.transform = ''; // Reset position when sidebar is hidden
            pageWrapper.style.width = '100%';
        }
    }
    }

    // Create a full-page wrapper to shift content when sidebar is visible
    function createPageWrapper() {
        const body = document.querySelector('body');
        let pageWrapper = document.getElementById('page-wrapper');

        if (!pageWrapper) {
            pageWrapper = document.createElement('div');
            pageWrapper.id = 'page-wrapper';
            body.prepend(pageWrapper); // Add the wrapper at the top of the body

            // Move everything inside the new wrapper
            const contentElements = body.children;
            Array.from(contentElements).forEach((element) => {
                if (element !== pageWrapper) {
                    pageWrapper.appendChild(element);
                }
            });

            // Apply styles to ensure the page wrapper takes full height and width
            pageWrapper.style.position = 'relative';
            pageWrapper.style.transition = 'width 0.3s ease, transform 0.3s ease'; // Smooth transition for shifting
            pageWrapper.style.width = '100%';
        }
    }

    // Adjust the page layout based on sidebar visibility
    function adjustPageWrapperLayout(showSidebar) {
        const pageWrapper = document.getElementById('page-wrapper');
        if (showSidebar) {
            if (!isPortrait()) {
            pageWrapper.style.transform = 'translateX(440px)'; // Move the page content to the left by sidebar width
            pageWrapper.style.width = 'calc(100% - 440px)'; // Move the page content to the left by sidebar width
            } else {}
        } else {
            pageWrapper.style.transform = ''; // Reset position when sidebar is hidden
            pageWrapper.style.width = '100%';
        }
    }

    // Function to toggle the sidebar visibility and adjust layout
    function toggleSidebar() {
        const sidebar = document.getElementById('transcriptSidebar');
        
        const isSidebarVisible = sidebar.style.display !== 'none';
        sidebar.style.display = isSidebarVisible ? 'none' : 'block';

        adjustPageWrapperLayout(!isSidebarVisible); // Shift the page content accordingly
    }

    let vttFiles = new Set();
    let videoElement = null;
    let transcriptCache = [];
    let toggleButton = null;
    let sidebar = null;
    let currentHighlight = null;

    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.name.endsWith('.vtt') && !vttFiles.has(entry.name)) {
                console.log('Detected .vtt file:', entry.name);
                vttFiles.add(entry.name);
                fetchTranscript(entry.name);
            }
        }
    });

    observer.observe({ entryTypes: ['resource'] });

    async function fetchTranscript(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            transcriptCache = parseVTT(text);
            showSidebar(transcriptCache);
            createToggleButton();
            startSync(); // Start synchronization
        } catch (error) {
            console.error('Error fetching or parsing VTT file:', error);
        }
    }

    function parseVTT(vttText) {
        const cues = [];
        const vttLines = vttText.split('\n');
        let timestamp = '';
        let text = '';
    
        for (let line of vttLines) {
            line = line.trim();
            
            // Match both timestamp formats
            const timestampMatch = line.match(/^(\d{2}:)?\d{2}:\d{2}\.\d{3} --> (\d{2}:)?\d{2}:\d{2}\.\d{3}/);
            
            if (timestampMatch) {
                if (timestamp && text) {
                    cues.push({ timestamp, text });
                    text = '';
                }
                // Extract just the starting timestamp
                timestamp = line.split(' ')[0];
            } else if (line && !line.startsWith('WEBVTT')) {
                text += (text ? ' ' : '') + line;
            }
        }
    
        if (timestamp && text) {
            cues.push({ timestamp, text });
        }
    
        return cues;
    }

    function startSync() {
        if (!videoElement) return;
    
        videoElement.addEventListener('timeupdate', () => {
            const currentTime = videoElement.currentTime;
            let activeCue = null;
    
            transcriptCache.forEach(({ timestamp }, index) => {
                const parts = timestamp.split(':').map(parseFloat);
    
                let cueTime;
                if (parts.length === 3) {
                    // HH:MM:SS.mmm format
                    cueTime = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2) {
                    // MM:SS.mmm format
                    cueTime = parts[0] * 60 + parts[1];
                } else {
                    console.error("Invalid timestamp format:", timestamp);
                    return;
                }
    
                if (currentTime >= cueTime) {
                    activeCue = index;
                }
            });
    
            if (activeCue !== null) highlightLine(activeCue);
        });
    }

    function highlightLine(index) {
        if (currentHighlight) {
            currentHighlight.style.textDecoration = '';
        }

        const { timestamp } = transcriptCache[index];
        const line = document.querySelector(`.transcript-line[data-timestamp="${timestamp}"]`);

        if (line) {
            line.style.textDecoration = 'underline dotted';
            currentHighlight = line;
        }
    }

    function showSidebar(transcript) {
        if (sidebar) {
            sidebar.innerHTML = '';
        } else {
            if (isPortrait()) {
                sidebar = document.createElement('div');
                sidebar.id = 'transcriptSidebar';
                sidebar.style.position = 'fixed';
                sidebar.style.bottom = '0';
                sidebar.style.left = '0';
                sidebar.style.width = '100%';
                sidebar.style.height = '50%';
                sidebar.style.overflowY = 'auto';
                sidebar.style.backgroundColor = '#fff';
                sidebar.style.borderTop = '1px solid #ccc';
                sidebar.style.padding = '20px';
                sidebar.style.zIndex = 9999;
                sidebar.style.fontFamily = 'NotoSans, sans-serif';
                sidebar.style.fontSize = '16px';
                sidebar.style.display = 'none';
                document.body.appendChild(sidebar);
            
                // Add content scroll spacer at bottom
                let spacer = document.getElementById('content-bottom-spacer');
                if (!spacer) {
                  spacer = document.createElement('div');
                  spacer.id = 'content-bottom-spacer';
                  spacer.style.height = '500px';
                  document.body.appendChild(spacer);
                }
              } else {
                // Landscape mode
                sidebar = document.createElement('div');
                sidebar.id = 'transcriptSidebar';
                sidebar.style.position = 'fixed';
                sidebar.style.top = '-11px';
                sidebar.style.left = '0';
                sidebar.style.width = '400px';
                sidebar.style.height = '100%';
                sidebar.style.overflowY = 'auto';
                sidebar.style.backgroundColor = '#fff';
                sidebar.style.borderRight = '1px solid #ccc';
                sidebar.style.padding = '20px';
                sidebar.style.zIndex = 9999;
                sidebar.style.fontFamily = 'NotoSans, sans-serif';
                sidebar.style.fontSize = '16px';
                sidebar.style.display = 'none';
                document.body.appendChild(sidebar);
              }
        }

        const controls = document.createElement('div');
        controls.id = 'transcriptSidebarControls';
        controls.style.cssText = 'position: sticky; top: -9px; z-index: 1000; display: flex; gap: 8px; align-items: center; padding-bottom: 10px; padding-top: 10px; background-color: #fff'

        const searchBox = document.createElement('input');
        searchBox.type = 'text';
        searchBox.placeholder = 'Search transcript...';
        searchBox.style.flex = '1';
        searchBox.style.padding = '8px';
        searchBox.classList.add('siteSearchKeywords');
        searchBox.style.marginTop = '-5px';
        searchBox.style.height = '41px';
        searchBox.oninput = () => resetSearch(searchBox.value);

        const prevButton = document.createElement('button');
        prevButton.textContent = '<';
        prevButton.style.padding = '8px';
        prevButton.style.backgroundColor = '#fff';
        prevButton.classList.add('secondaryButton');
        prevButton.onclick = () => navigateSearch(-1);
        prevButton.title = 'Go to the previous match in the transcript';

        const nextButton = document.createElement('button');
        nextButton.textContent = '>';
        nextButton.style.padding = '8px';
        nextButton.style.backgroundColor = '#fff';
        nextButton.classList.add('secondaryButton');
        nextButton.onclick = () => navigateSearch(1);
        nextButton.title = 'Go to the next match in the transcript';

        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.padding = '8px';
        closeButton.classList.add('primaryButton');
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.cursor = 'pointer';
        closeButton.title = 'Close the transcript sidebar';
        closeButton.onclick = () => {
            toggleSidebar();
            toggleButton.style.display = 'block';
        };

        const scrollButton = document.createElement('button');
        scrollButton.textContent = '▼';
        scrollButton.style.padding = '8px';
        scrollButton.classList.add('primaryButton');
        scrollButton.style.color = 'white';
        scrollButton.style.border = 'none';
        scrollButton.style.cursor = 'pointer';
        scrollButton.onclick = scrollToCurrent;
        scrollButton.title = 'Scroll to the current transcript line';

        controls.appendChild(searchBox);
        controls.appendChild(prevButton);
        controls.appendChild(nextButton);
        controls.appendChild(scrollButton);
        controls.appendChild(closeButton);

        const resultsCount = document.createElement('span');
        resultsCount.style.cssText = 'display: block; position: absolute; right: 181px; text-align: right; font-size: 8px; bottom: 19px;'
        searchBox.insertAdjacentElement('afterend', resultsCount); // Insert after the search box

        sidebar.appendChild(controls);

        monitorOrientation();

        // Process VTT and group lines into natural paragraphs
        let currentParagraph = document.createElement('div');
        currentParagraph.style.marginBottom = '10px';
        sidebar.appendChild(currentParagraph);

        function removeLeadingQuoteFromText(text) {
            // Regular expression to remove a leading quote if followed by a lowercase letter
            return text.replace(/^“([a-z])/g, '$1');
        }

        function createTextWithItalics(text) {
            const fragment = document.createDocumentFragment();
            const parts = text.split(/(<i>.*?<\/i>)/g);  // Splits text into regular and italic parts
            parts.forEach(part => {
                if (part.startsWith('<i>') && part.endsWith('</i>')) {
                    const italicSpan = document.createElement('span');
                    italicSpan.style.fontStyle = 'italic';
                    italicSpan.textContent = part.slice(3, -4);  // Remove <i> and </i> tags
                    fragment.appendChild(italicSpan);
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            return fragment;
        }

        transcript.forEach(({ timestamp, text }, index) => {
            // Create a clickable VTT line for each line
            const cleanedText = removeLeadingQuoteFromText(text);
            //const formattedText = formatTextWithItalics(cleanedText);

            const line = document.createElement('span');
            line.appendChild(createTextWithItalics(cleanedText));
            line.appendChild(document.createTextNode(' '));
            line.dataset.timestamp = timestamp;
            line.style.cursor = 'pointer';
            //line.style.paddingRight = '5px';
            line.style.textUnderlineOffset = '.4ex';
            line.style.transition = 'underline 0.3s ease';
            line.style.display = 'inline';
            line.classList.add('transcript-line');

            // Highlight the line on mouseover
            line.onmouseover = () => line.style.textDecoration = 'underline dotted';
            line.onmouseout = () => line.style.textDecoration = '';

            // Add click event to jump to timestamp
            line.onclick = () => seekToTimestamp(line.dataset.timestamp);

            // Append this line to the current paragraph
            currentParagraph.appendChild(line);

            // Check for punctuation and time gap to detect new paragraph
            const prevLine = transcriptCache[index - 1];
            const nextLine = transcriptCache[index + 1];

            const punctuationEnding = /[.!?]$/;
            const startsWithCapital = /^[A-Z]/;
            const lineGap = nextLine ? getTimeDifference(timestamp, nextLine.timestamp) : 0;

            // Conditions to start a new paragraph:
            const startsNewParagraph = (
                (punctuationEnding.test(text) && startsWithCapital.test(nextLine?.text || '')) || // Ends with punctuation, next starts with a capital
                (lineGap > 999) // If the gap between lines is more than x seconds, it's likely a new paragraph
            );

            // Check for semantic grouping with conjunctions (e.g., 'so', 'however', 'but')
            const continuesParagraph = /(so|however|but)\b/i.test(text);

            if (startsNewParagraph && !continuesParagraph) {
                currentParagraph = document.createElement('div');
                currentParagraph.style.marginBottom = '10px';
                sidebar.appendChild(currentParagraph);
            }
        });

        // Utility function to get time difference between two timestamps
        function getTimeDifference(timestamp1, timestamp2) {
            const [hours1, minutes1, seconds1] = timestamp1.split(':').map(parseFloat);
            const [hours2, minutes2, seconds2] = timestamp2.split(':').map(parseFloat);
            const time1InSeconds = hours1 * 3600 + minutes1 * 60 + seconds1;
            const time2InSeconds = hours2 * 3600 + minutes2 * 60 + seconds2;
            return Math.abs(time1InSeconds - time2InSeconds);
        }

        // Footer Spacer
        const footerSpacer = document.createElement('div');
        footerSpacer.style.cssText = 'height: 40px;';
        sidebar.appendChild(footerSpacer);

        sidebar.style.display = 'none';
        findVideoElement();
    }

    // Function to seek to a specific timestamp
    function seekToTimestamp(timestamp) {
        const timeInSeconds = parseTimestamp(timestamp);
        if (isFinite(timeInSeconds)) {
            videoElement.currentTime = timeInSeconds;
        } else {
            console.error('Invalid timestamp:', timestamp);
        }
    }

    // Function to parse timestamp (HH:MM:SS.mmm or MM:SS.mmm --> seconds)
    function parseTimestamp(timestamp) {
        const parts = timestamp.split(':').map(parseFloat);
    
        if (parts.length === 3) {
            // HH:MM:SS.mmm format
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // MM:SS.mmm format (no hours)
            return parts[0] * 60 + parts[1];
        } else {
            console.error("Invalid timestamp format:", timestamp);
            return NaN;
        }
    }

    // Search functionality
    let searchResults = [];
    let currentSearchIndex = -1;

    function resetSearch(term) {
        let resultsCount = document.querySelector('.siteSearchKeywords + span'); // Select the span next to the search box
        searchResults.forEach(({ element }) => element.style.backgroundColor = ''); // Reset all search highlights
        selectedResults = []; // Reset selected results

        searchResults = [];
        currentSearchIndex = -1;

        if (!term) {
            if (resultsCount) {
                resultsCount.textContent = '';
            }
            return;
        }

        const lines = document.querySelectorAll('.transcript-line');
        lines.forEach((line, index) => {
            if (line.textContent.toLowerCase().includes(term.toLowerCase())) {
                searchResults.push({ element: line, index });
            }
        });

        if (searchResults.length > 0) {
            currentSearchIndex = 0;
            highlightSearchResult();

            // Select the first result by default
            selectedResults[0] = true;
        }
        if (resultsCount) {
            updateCounter(resultsCount);
        }
    }

    function updateCounter(resultsCount) {
        const selectedCount = selectedResults.filter(Boolean).length;
        resultsCount.textContent = `(${selectedCount} of ${searchResults.length} selected)`;
    }

    function highlightSearchResult() {
        searchResults.forEach(({ element }) => element.style.backgroundColor = ''); // Reset all search highlights
        const { element } = searchResults[currentSearchIndex];
        element.style.backgroundColor = '#ffe87c'; // Highlight the current search result
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function navigateSearch(direction) {
        if (searchResults.length === 0) return;

        const previousIndex = currentSearchIndex; // Store the previous index

        currentSearchIndex += direction;
        if (currentSearchIndex < 0) currentSearchIndex = searchResults.length - 1;
        if (currentSearchIndex >= searchResults.length) currentSearchIndex = 0;

        highlightSearchResult();

        // Update the counter without toggling selection
        updateSearchCounter(document.querySelector('.siteSearchKeywords + span'));
    }

    function updateSearchCounter(resultsCount) {
        resultsCount.textContent = `(${currentSearchIndex + 1} of ${searchResults.length} selected)`;
    }

    // Create a toggle button to show the sidebar
    function createToggleButton() {
        toggleButton = document.createElement('button');
        toggleButton.id = 'toggleButton';
        toggleButton.textContent = 'Show Transcript';
        toggleButton.style.position = 'fixed';
        toggleButton.classList.add('primaryButton');
        toggleButton.style.bottom = '11px';
        toggleButton.style.left = '28px';
        toggleButton.style.zIndex = '9999';
        toggleButton.style.color = 'white';
        toggleButton.style.padding = '8px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.display = 'block';
        toggleButton.style.fontFamily = 'NotoSans, sans-serif';
        toggleButton.style.fontSize = '16px';

        toggleButton.onclick = () => {
            toggleSidebar();
            toggleButton.style.display = 'none';
        };

        document.body.appendChild(toggleButton);
    }

    function scrollToCurrent() {
        if (currentHighlight) {
            currentHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Function to find the video element on the page
    function findVideoElement() {
        if (!videoElement) {
            videoElement = document.querySelector('video');
            if (!videoElement) {
                console.error('Video element not found!');
            } else {
                videoElement.addEventListener('timeupdate', () => {
                    const currentTime = videoElement.currentTime;
                    let closestCue = null;
                    let closestTimeDiff = Infinity;

                    transcriptCache.forEach(({ timestamp }, index) => {
                        const [hours, minutes, seconds] = timestamp.split(':');
                        const cueTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
                        const timeDiff = Math.abs(cueTime - currentTime);

                        if (timeDiff < closestTimeDiff) {
                            closestCue = index;
                            closestTimeDiff = timeDiff;
                        }
                    });

                    if (closestCue !== null) highlightLine(closestCue);
                });
            }
        }
    }


    // Add an event listener to the window object that listens for the hashchange event
    window.addEventListener('hashchange', reinitialize);

    // Listen for orientation change events and update sidebar layout
    window.addEventListener('orientationchange', monitorOrientation);

    // Listen for window resize events and update sidebar layout
    window.addEventListener('resize', monitorOrientation);

    function reinitialize() {
        // Reset variables and remove old elements
        vttFiles.clear();
        videoElement = null;
        transcriptCache = [];
        currentHighlight = null;

        // Remove old elements
        if (toggleButton) {
            toggleButton.remove();
            toggleButton = null; // Reset the variable
        }
        if (sidebar) {
            sidebar.scrollTop = 0; // Ensure sidebar resets to the top
            sidebar.remove();
            sidebar = null; // Reset the variable
        }

        // Reset page layout
        adjustPageWrapperLayout(false); // Pass false to reset the layout

        // Re-run initialization logic
        findVideoElement();
    }

    // Initialize everything
    createPageWrapper();
})();