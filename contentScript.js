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
        let PageSearchInputElement = document.querySelector('.siteSearchKeywords'); // Select the page search input element by its class name
        let placeholderValue = PageSearchInputElement ? PageSearchInputElement.getAttribute('placeholder') : null; // Get the placeholder attribute value
        searchBox.placeholder = placeholderValue;
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
        //toggleButton.textContent = 'Show Transcript';
        toggleButton.placeholder = 'Show Transcript';
        toggleButton.style.position = 'fixed';
        toggleButton.classList.add('primaryButton');
        toggleButton.style.bottom = '11px';
        toggleButton.style.left = '28px';
        toggleButton.style.zIndex = '9999';
        toggleButton.style.color = 'white';
        //toggleButton.style.padding = '8px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.display = 'block';
        toggleButton.style.fontFamily = 'NotoSans, sans-serif';
        toggleButton.style.fontSize = '16px';

        // SVG setup
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '45');
        svg.setAttribute('height', '45');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('xmlns:svg', svgNS);
        svg.setAttribute('enable-background', 'new 0 0 316 431');
        svg.setAttribute('version', '1.1');
        svg.setAttribute('xml:space', 'preserve');

        const gLayer = document.createElementNS(svgNS, 'g');
        gLayer.setAttribute('class', 'layer');

        const gMain = document.createElementNS(svgNS, 'g');
        gMain.setAttribute('id', 'svg_14');
        gMain.setAttribute('transform', 'translate(0, 0.25) translate(0, 0.25) translate(0, 0.25) translate(0, 0.25) translate(0, 0.25) translate(-0.25) matrix(0.0825655, 0, 0, 0.0825655, 15.0027, 10.7365)');

        const paths = [
            { d: "m151.53,-67c1.31,1.35 1.94,2.92 3.03,4.02c33.78,33.85 67.62,67.64 101.35,101.55c1.54,1.55 2.95,4.1 2.96,6.19c0.17,44.49 0.13,88.98 0.12,133.47c0,0.83 -0.07,1.65 -0.18,3.69c-6.14,-4.56 -11.71,-8.7 -17.81,-13.23c0,-37.12 0,-75.09 0,-113.45c-34.56,0 -68.96,0 -103.76,0c0,-35.13 0,-69.86 0,-104.92c-55.45,0 -110.52,0 -165.91,0c0,122.87 0,245.93 0,369.68c1.5,0 3.25,0 5,0c62.15,0 124.31,0.05 186.46,-0.09c5.26,-0.01 9.61,0.77 13.97,4.18c5.79,4.53 12.4,8.01 18.64,11.97c0.51,0.32 0.91,0.8 2.17,1.94c-81.57,0 -162.1,0 -243.1,0c-0.47,-134.9 -0.47,-269.8 -0.47,-405c65.69,0 131.37,0 197.53,0m66.88,104c3.07,0 6.14,0 10.3,0c-23.8,-23.74 -46.76,-46.66 -69.78,-69.52c-0.86,-0.85 -2.27,-1.14 -3.67,-1.81c0,24.21 0,47.64 0,71.33c20.9,0 41.54,0 63.15,0z", id: "svg_2" },
            { d: "m159.47,364c-0.47,-3.81 -0.47,-7.62 -0.47,-11.82c16.27,0 32.35,0 48.71,0c0,-9.13 0,-17.88 0,-26.95c-9.16,-2.05 -17.66,-5.57 -25.21,-11.88c-9.03,-7.57 -14.88,-17.01 -16.2,-28.21c-1.35,-11.38 -0.3,-23.05 -0.3,-34.87c2.99,0 6.72,0 11,0c0,6.41 0.02,12.85 0,19.29c-0.03,9 0.94,17.78 6.01,25.58c6.85,10.5 16.12,16.74 28.96,17.98c11.58,1.12 20.95,-3.47 28.84,-10.74c7.17,-6.6 10.76,-15.67 11.12,-25.55c0.33,-8.78 0.07,-17.58 0.07,-26.6c4.07,0 7.8,0 12.12,0c-1.04,14.44 2.31,29.07 -3.16,43.04c-6.39,16.31 -18.14,26.74 -35.36,30.75c-1.41,0.32 -2.77,0.83 -4.4,1.33c0,8.58 0,17.35 0,26.65c16,0 31.93,0 48.33,0c0.47,3.99 0.47,7.97 0.47,12c-36.69,0 -73.38,0 -110.53,0z", id: "svg_3" },
            { d: "m189.18,295.67c-5.9,-7.2 -6.97,-15.61 -7.08,-23.99c-0.3,-21.65 -0.32,-43.3 0.01,-64.94c0.13,-8.2 1.26,-16.29 6.71,-23.33c5.46,-7.03 12.12,-11.09 20.89,-12.48c14.16,-2.25 25.05,3.03 32.11,14.82c3.15,5.26 4.81,12.13 4.95,18.32c0.56,23.63 0.57,47.29 0.12,70.93c-0.33,16.79 -8.98,28.58 -25.54,32.57c-10.06,2.43 -20.11,-0.02 -28.03,-7.76c-1.31,-1.28 -2.6,-2.57 -4.14,-4.14m16.67,-1.68c7.24,3.49 14.24,2.72 20.5,-2.02c4.4,-3.33 7.34,-7.84 7.63,-14.18c-5.99,0 -11.4,0 -16.68,0c0,-4.14 0,-7.88 0,-11.99c5.72,0 11.13,0 16.4,0c0,-3.48 0,-6.55 0,-10c-5.71,0 -11.12,0 -16.4,0c0,-4.14 0,-7.88 0,-11.99c5.7,0 11.11,0 16.41,0c0,-3.47 0,-6.54 0,-9.99c-5.7,0 -11.11,0 -16.42,0c0,-4.14 0,-7.88 0,-12c5.7,0 11.11,0 16.43,0c0,-3.13 0,-5.87 0,-8.98c-5.69,0 -11.11,0 -16.44,0c0,-4.15 0,-7.88 0,-11.94c5.72,0 11.16,0 16.57,0c0.37,-9.23 -9.1,-18.6 -20.63,-18.13c-9.56,0.39 -18.2,10.21 -18.21,18.82c-0.03,23.64 0.23,47.28 -0.13,70.92c-0.14,9.11 2.56,16.17 10.97,21.48z", id: "svg_4" },
            { d: "m55,141c51.81,0 103.11,0 154.71,0c0,5.94 0,11.68 0,17.71c-68.66,0 -137.4,0 -206.42,0c0,-5.65 0,-11.39 0,-17.71c17.02,0 34.11,0 51.71,0z", id: "svg_5" },
            { d: "m20,119c-5.81,0 -11.12,0 -16.71,0c0,-5.62 0,-11.02 0,-16.72c68.67,0 137.4,0 206.42,0c0,5.34 0,10.75 0,16.72c-63.03,0 -126.12,0 -189.71,0z", id: "svg_6" },
            { d: "m67,199c-21.47,0 -42.45,0 -63.71,0c0,-5.94 0,-11.68 0,-17.71c55.34,0 110.75,0 166.37,0c-2.67,5.46 -5.2,11.13 -8.26,16.51c-0.57,1.01 -3.23,1.15 -4.92,1.15c-29.66,0.07 -59.32,0.05 -89.48,0.05z", id: "svg_7" },
            { d: "m10.07,239c-2.48,0 -4.46,0 -6.76,0c0,-5.9 0,-11.64 0,-17.69c51.27,0 102.67,0 154.38,0c0,5.59 0,11.34 0,17.69c-48.96,0 -98.04,0 -147.62,0z", id: "svg_8" },
            { d: "m116,278c-37.81,0 -75.11,0 -112.71,0c0,-5.61 0,-11.02 0,-16.71c51.33,0 102.73,0 154.42,0c0,5.32 0,10.73 0,16.71c-13.68,0 -27.45,0 -41.71,0z", id: "svg_9" },
            { d: "m105,67.1c0,4.46 0,8.43 0,12.65c-34.02,0 -67.76,0 -101.75,0c0,-5.77 0,-11.51 0,-17.5c33.78,0 67.51,0 101.75,0c0,1.48 0,2.92 0,4.85z", id: "svg_10" },
            { d: "m251.29,324.21c2.19,-1.73 4.12,-3.21 6.31,-4.89c0,6.08 0,12.17 0,18.47c-8.68,0 -17.38,0 -26.42,0c6.77,-4.55 13.31,-8.94 20.11,-13.58z", id: "svg_11" },
        ];

        for (const { d, id } of paths) {
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', '#FFFFFF');
            path.setAttribute('id', id);
            path.setAttribute('opacity', '1');
            gMain.appendChild(path);
        }

        gLayer.appendChild(gMain);
        svg.appendChild(gLayer);
        toggleButton.appendChild(svg);

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