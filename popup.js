document.addEventListener("DOMContentLoaded", () => {
    const clearBtn = document.getElementById("clear-btn");
    const statusDiv = document.getElementById("status");

    clearBtn.addEventListener("click", () => {
        chrome.storage.local.clear(() => {
            statusDiv.style.display = "block";
            setTimeout(() => {
                statusDiv.style.display = "none";
            }, 2000);
        });
    });
});