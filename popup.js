document.addEventListener("DOMContentLoaded", () => {
    const clearBtn = document.getElementById("clear-btn");
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const exportBtn = document.getElementById("export-btn");
    const retentionDaysInput = document.getElementById("retention-days");
    const statusDiv = document.getElementById("status");

    const statTotal = document.getElementById("stat-total");
    const statProgress = document.getElementById("stat-progress");
    const statApplied = document.getElementById("stat-applied");

    const STATE_IN_PROGRESS = 1;
    const STATE_DONE = 2;

    function showStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? "red" : "green";
        statusDiv.style.display = "block";
        setTimeout(() => {
            statusDiv.style.display = "none";
        }, 2000);
    }

    function loadData() {
        chrome.storage.local.get(null, (items) => {
            let total = 0;
            let inProgress = 0;
            let applied = 0;

            for (const [key, value] of Object.entries(items)) {
                if (key === "_githired_settings") {
                    if (value && value.retentionDays) {
                        retentionDaysInput.value = value.retentionDays;
                    }
                    continue;
                }

                total++;
                let state = 0;
                if (typeof value === "object" && value !== null) {
                    state = value.state !== undefined ? value.state : 0;
                } else if (typeof value === "number") {
                    state = value;
                }

                if (state === STATE_IN_PROGRESS) inProgress++;
                if (state === STATE_DONE) applied++;
            }

            statTotal.textContent = total;
            statProgress.textContent = inProgress;
            statApplied.textContent = applied;
        });
    }

    loadData();

    clearBtn.addEventListener("click", () => {
        if(confirm("Are you sure you want to clear all tracked jobs? This cannot be undone.")) {
            chrome.storage.local.clear(() => {
                showStatus("Data cleared!");
                loadData();
            });
        }
    });

    saveSettingsBtn.addEventListener("click", () => {
        const days = parseInt(retentionDaysInput.value, 10);
        if (isNaN(days) || days < 1) {
            showStatus("Please enter a valid number.", true);
            return;
        }
        chrome.storage.local.set({ "_githired_settings": { retentionDays: days } }, () => {
            showStatus("Settings saved!");
        });
    });

    exportBtn.addEventListener("click", () => {
        chrome.storage.local.get(null, (items) => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "githired_data.json");
            dlAnchorElem.click();
            showStatus("Data exported!");
        });
    });
});