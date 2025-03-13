let url = window.location.href;
let primaryKey = "" ;
let platformName = "" ;
let problemTitle = "" ;
let problemName = "" ;
let problemUrl = "" ;
const trackerKey = "1234567890" ;

if(isValidDSAUrl(url)) {
    updateInformation();
    addButton();
}else{
    removeButton();
    console.log("Invalid URL");
}

function updateInformation() {
    let details = extractProblemDetails(url);
    if(details) {
        primaryKey = details.primaryKey;
        platformName = details.platformName;
        problemTitle = details.problemTitle;
        problemName = details.problemName;
        problemUrl = details.problemUrl;
    }
    // console.log("Updated Information: ", {primaryKey, platformName, problemTitle, problemName, problemUrl});
}

function isValidDSAUrl(url) {
    // console.log("Checking URL: ", url);
    const validPatterns = [
        /^https:\/\/cses\.fi\/problemset\/task\/.*/,    // CSES: Numeric task ID
        /^https:\/\/leetcode\.com\/problems\/.*/,       // LeetCode: Any problem URL
        /^https:\/\/maang\.in\/problems\/[^\/]+\/?$/    // Maang: Problem name-based URL
    ];

    let ans = validPatterns.some(pattern => pattern.test(url));
    // console.log(ans);
    return ans ;
}


function extractProblemDetails(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        let platformName, problemTitle, problemName;

        if (domain.includes("leetcode.com")) {
            platformName = "LeetCode";
            const parts = urlObj.pathname.split("/").filter(Boolean);
            problemTitle = parts[1]; // Extracting the problem title from the URL
        } 
        else if (domain.includes("cses.fi")) {
            platformName = "CSES";
            const parts = urlObj.pathname.split("/").filter(Boolean);
            problemTitle = parts[parts.length - 1]; // Last part of the URL
        } 
        else if (domain.includes("maang.in")) {
            platformName = "Maang";
            const parts = urlObj.pathname.split("/").filter(Boolean);
            problemTitle = parts[parts.length - 1]; // Last part of the URL
        } 
        else {
            throw new Error("Unsupported platform");
        }

        // Convert problemTitle to a readable format
        problemName = problemTitle.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        return {
            primaryKey: `${platformName}#${problemTitle}`,
            platformName,
            problemTitle,
            problemName,
            problemUrl: url
        };
    } catch (error) {
        console.error("Error extracting problem details:", error.message);
        return null;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "urlChanged") {
        url = window.location.href;
        if(isValidDSAUrl(url)){
            updateInformation();
            removeButton();
            addButton();
        }else{
            removeButton();
            // console.log("Invalid URL");
        }
    }
});

// all button and menu related code

function addButton() {
    // Check if the button already exists
    if (document.getElementById("dsaTrackerButton")) return;

    // Create the button element
    const button = document.createElement("button");
    button.id = "dsaTrackerButton";
    button.innerText = "+";

    // Add event listener to open popup
    button.addEventListener("click", openPopup);
    button.addEventListener("click", togglePopup);

    // Append to the document body
    document.body.appendChild(button);
}

function removeButton() {
    const button = document.getElementById("dsaTrackerButton");
    if (button) {
        button.remove();
        const popup = document.getElementById("dsaTrackerPopup");
        if (popup) {
            popup.remove();
        }
    }
}

function loadNotes(primaryKey, callback) {
    chrome.storage.local.get([trackerKey], (result) => {
        const problemList = result[trackerKey] || {}; // Get stored data or initialize an empty object
        const problemData = problemList[primaryKey] || null; // Get problem details if exists

        callback(problemData); // Pass data to callback function
    });
}

function openPopup() {
    // Check if the popup already exists
    if (document.getElementById("dsaTrackerPopup")) return;

    // Create the popup container
    const popup = document.createElement("div");
    popup.id = "dsaTrackerPopup";

    // Problem Name Display (Read-Only)
    const problemNameLabel = document.createElement("label");
    problemNameLabel.innerText = `Problem: ${problemName}`;

    // Notes Input Field
    const notesInput = document.createElement("textarea");
    notesInput.id = "dsaTrackerNotes";
    notesInput.placeholder = "Write your notes here...";

    // Buttons Container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";

    // Save Button
    const saveButton = document.createElement("button");
    saveButton.innerText = "Save";
    saveButton.className = "save-button";
    saveButton.onclick = function () {
        saveNotes(primaryKey, platformName, problemName, problemUrl, notesInput.value);
        document.body.removeChild(popup);
    };

    // Cancel Button
    const cancelButton = document.createElement("button");
    cancelButton.innerText = "Cancel";
    cancelButton.className = "cancel-button";
    cancelButton.onclick = function () {
        togglePopup();
        document.body.removeChild(popup);
    };

    // Append elements
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    popup.appendChild(problemNameLabel);
    popup.appendChild(notesInput);
    popup.appendChild(buttonContainer);
    document.body.appendChild(popup);

    // Load existing notes (if any)
    loadNotes(primaryKey, (data) => {
        if (data) {
            notesInput.value = data.notes;
        }
    });
}

async function saveNotes(primaryKey, platformName, problemName, problemUrl, notes) {
    try {
        // Retrieve the existing problem list from storage
        chrome.storage.local.get([trackerKey], function (result) {
            let problemList = result[trackerKey] || {}; // If not found, initialize empty object

            // Update the problem details
            problemList[primaryKey] = {
                platformName,
                problemName,
                problemUrl,
                notes,
            };
            console.log(problemList[primaryKey]);
            // Save updated problem list back to storage
            chrome.storage.local.set({ [trackerKey]: problemList }, function () {
                // console.log("Notes saved successfully:", problemList[primaryKey]);
                alert("Notes saved successfully!");
            });
        });
    } catch (error) {
        console.error("Error saving notes:", error);
    }
}

function togglePopup() {
    let popup = document.getElementById("dsaTrackerPopup");
    
    if (popup.classList.contains("show")) {
        popup.classList.remove("show");
        popup.classList.add("hide");
    } else {
        popup.classList.remove("hide");
        popup.classList.add("show");
    }
}

// function openPopup() {
//     if (document.getElementById("dsaTrackerPopup")) return;

//     const popup = document.createElement("div");
//     popup.id = "dsaTrackerPopup";
//     popup.classList.add("draggable");

//     // Popup Header for Dragging
//     const popupHeader = document.createElement("div");
//     popupHeader.id = "dsaTrackerPopupHeader";
//     popupHeader.innerText = "Drag Me";
//     popupHeader.style.cursor = "move";
//     popupHeader.style.backgroundColor = "#f1f1f1";
//     popupHeader.style.padding = "5px";
//     popupHeader.style.fontWeight = "bold";
//     popupHeader.style.textAlign = "center";
//     popupHeader.style.borderRadius = "8px 8px 0 0";

//     // Problem Name Display (Read-Only)
//     const problemNameLabel = document.createElement("label");
//     problemNameLabel.innerText = `Problem: ${problemName}`;

//     // Notes Input Field (Resizable)
//     const notesInput = document.createElement("textarea");
//     notesInput.id = "dsaTrackerNotes";
//     notesInput.placeholder = "Write your notes here...";
//     notesInput.style.resize = "both";
//     notesInput.style.overflow = "auto";

//     // Buttons Container
//     const buttonContainer = document.createElement("div");
//     buttonContainer.className = "button-container";

//     // Save Button
//     const saveButton = document.createElement("button");
//     saveButton.innerText = "Save";
//     saveButton.className = "save-button";
//     saveButton.onclick = function () {
//         console.log(primaryKey,platformName,problemName,problemUrl,notesInput.value);
//         saveNotes(primaryKey, platformName, problemName, problemUrl, notesInput.value);
//         document.body.removeChild(popup);
//     };

//     // Cancel Button
//     const cancelButton = document.createElement("button");
//     cancelButton.innerText = "Cancel";
//     cancelButton.className = "cancel-button";
//     cancelButton.onclick = function () {
//         togglePopup();
//         document.body.removeChild(popup);
//     };

//     buttonContainer.appendChild(saveButton);
//     buttonContainer.appendChild(cancelButton);
//     popup.appendChild(popupHeader);
//     popup.appendChild(problemNameLabel);
//     popup.appendChild(notesInput);
//     popup.appendChild(buttonContainer);
//     document.body.appendChild(popup);

//     loadNotes(primaryKey, (data) => {
//         if (data) {
//             notesInput.value = data.notes;
//         }
//     });

//     makeDraggableAndResizable(popup, popupHeader);
// }

// Function to make the popup draggable and resizable
function makeDraggableAndResizable(popup, header) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    header.addEventListener("mousedown", (event) => {
        isDragging = true;
        offsetX = event.clientX - popup.offsetLeft;
        offsetY = event.clientY - popup.offsetTop;
        header.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (event) => {
        if (!isDragging) return;
        popup.style.left = `${event.clientX - offsetX}px`;
        popup.style.top = `${event.clientY - offsetY}px`;
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        header.style.cursor = "move";
    });
}
