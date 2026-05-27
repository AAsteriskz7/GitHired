// content.js

// Define our three states
const STATE_TODO = 0;
const STATE_IN_PROGRESS = 1;
const STATE_DONE = 2;

// Visual representation of states
const STATE_ICONS = {
    [STATE_TODO]: "⬜",
    [STATE_IN_PROGRESS]: "🟨",
    [STATE_DONE]: "✅"
};

/**
 * Generates a SHA-256 hash to act as a resilient Primary Key.
 */
async function generateUniqueID(companyName, applicationUrl) {
    const rawString = `${companyName.trim().toLowerCase()}_${applicationUrl.trim()}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Updates the visual icon of the toggle.
 */
function updateToggleUI(element, state) {
    element.innerText = STATE_ICONS[state];
    element.title = state === STATE_TODO ? "To Do" :
        state === STATE_IN_PROGRESS ? "In Progress (Clicked)" : "Applied!";
}

/**
 * Extracts data from a table row and injects the UI.
 */
async function processRow(tr) {
    // Prevent re-processing the same row multiple times during DOM mutations
    if (tr.dataset.sweTrackerProcessed) return;
    tr.dataset.sweTrackerProcessed = "true";

    // --- UNIVERSAL LINK EXTRACTION LOGIC ---

    // 1. Try to find an explicit "Apply" image button first (SpeedyApply format)
    let applyAnchor = tr.querySelector('td a img[alt="Apply"]')?.closest('a');

    // 2. Fallback: Find the first link that is NOT in the Company (first) column (Jobright / Simplify format)
    if (!applyAnchor) {
        const firstCell = tr.querySelector('td:first-child');
        const allAnchors = Array.from(tr.querySelectorAll('td a'));
        // Find the first anchor whose parent cell is not the first cell
        applyAnchor = allAnchors.find(a => a.closest('td') !== firstCell);
    }

    // If we still can't find a job application link, skip this row
    if (!applyAnchor) return;

    const applicationUrl = applyAnchor.href;

    // Locate the Company Name in the first column
    const companyCell = tr.querySelector('td:first-child');
    const companyName = companyCell.textContent.trim();

    // Generate our Primary Key
    const jobId = await generateUniqueID(companyName, applicationUrl);

    // Fetch existing state from Chrome Local Storage
    chrome.storage.local.get([jobId], (result) => {
        let storedData = result[jobId];
        let currentState = STATE_TODO;

        if (storedData !== undefined) {
            if (typeof storedData === 'number') {
                // Backward compatibility: Handle plain integers
                currentState = storedData;
            } else if (typeof storedData === 'object' && storedData !== null) {
                // Handle objects with state and timestamp
                currentState = storedData.state !== undefined ? storedData.state : STATE_TODO;
            }
        }

        // Build the toggle element
        const toggle = document.createElement('span');
        toggle.className = 'swe-tracker-toggle';
        toggle.style.cursor = 'pointer';
        toggle.style.marginRight = '8px';
        toggle.style.userSelect = 'none';
        toggle.style.fontSize = '1.1em';
        updateToggleUI(toggle, currentState);

        // Inject toggle seamlessly into the DOM before the company name
        companyCell.insertBefore(toggle, companyCell.firstChild);

        // EVENT 1: Manual Click (Toggle between Done and To-Do)
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // If it is Done, revert to To Do. Otherwise, mark as Done.
            currentState = currentState === STATE_DONE ? STATE_TODO : STATE_DONE;
            updateToggleUI(toggle, currentState);
            chrome.storage.local.set({ [jobId]: { state: currentState, timestamp: Date.now() } });
        });

        // EVENT 2: Auto-trigger "In Progress" when Apply link is clicked
        applyAnchor.addEventListener('click', () => {
            // Only transition to In Progress if it hasn't been completed yet
            if (currentState === STATE_TODO) {
                currentState = STATE_IN_PROGRESS;
                updateToggleUI(toggle, currentState);
                chrome.storage.local.set({ [jobId]: { state: currentState, timestamp: Date.now() } });
            }
        });
    });
}

/**
 * Cleans up old job states from Chrome Local Storage.
 * Removes any entries older than the user-configured retention period (default 30 days).
 */
function cleanupOldJobs() {
    chrome.storage.local.get(null, (items) => {
        let retentionDays = 30;
        if (items["_githired_settings"] && items["_githired_settings"].retentionDays) {
            retentionDays = items["_githired_settings"].retentionDays;
        }

        const now = Date.now();
        const retentionInMillis = retentionDays * 24 * 60 * 60 * 1000;
        const keysToRemove = [];

        for (const [key, value] of Object.entries(items)) {
            if (key === "_githired_settings") continue;

            // If it's a plain number, we could choose to convert it or remove it.
            // For now, let's just let the user re-click or keep it.
            // If it has a timestamp, we check it.
            if (typeof value === 'object' && value !== null && value.timestamp) {
                if (now - value.timestamp > retentionInMillis) {
                    keysToRemove.push(key);
                }
            } else if (typeof value === 'number') {
                // If we also want to remove legacy numeric items that are old,
                // we can't really tell their age. Let's leave them be for now.
            }
        }

        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
        }
    });
}

/**
 * Scans the page for markdown tables and processes their rows.
 */
function initTracker() {
    cleanupOldJobs();
    const rows = document.querySelectorAll('table tbody tr');
    rows.forEach(processRow);
}

// Initialize on first load
initTracker();

// Set up a MutationObserver. 
// GitHub loads new files dynamically without a full page refresh. 
// This watches the DOM and re-runs our script when the table changes.
const observer = new MutationObserver((mutations) => {
    let shouldInit = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
            shouldInit = true;
            break;
        }
    }
    if (shouldInit) {
        setTimeout(initTracker, 100);
    }
});

observer.observe(document.body, { childList: true, subtree: true });