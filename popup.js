const trackerKey = "1234567890";

// Function to get the problem list from chrome.storage
function getProblemList() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get([trackerKey], function (results) {
            
            resolve(results[trackerKey] || {});
        });
    });
}

// Function to convert problem data to CSV format
function convertToCSV(data) {
    const headers = ["Platform", "Name", "URL", "Topic", "Status", "Notes"];
    const rows = Object.values(data).map(problem => [
        `"${problem.platformName}"`,
        `"${problem.problemName}"`,
        `"${problem.problemUrl}"`,
        `"${problem.topic || ''}"`,
        `"${problem.status || 'Not Solved'}"`,
        `"${problem.notes || ''}"`,
    ]);
    return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

// Function to download CSV file
async function downloadCSV() {
    const problemMap = await getProblemList();
    if (Object.keys(problemMap).length === 0) {
        alert("No problems to download.");
        return;
    }

    const csvContent = convertToCSV(problemMap);
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "problems.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to display the list of problems in the popup
async function displayProblems() {
    const problemMap = await getProblemList();
    console.log(problemMap);
    const problemListContainer = document.getElementById("problem-list");

    // Clear the container before displaying the problems
    problemListContainer.innerHTML = "";

    if (Object.keys(problemMap).length === 0) {
        document.getElementById("download-csv").style.display = "none";
        problemListContainer.innerHTML = '<p>No problems saved yet.</p>';
    } else {
        for (let primaryKey in problemMap) {
            const problem = problemMap[primaryKey];
            const problemItem = document.createElement("div");
            problemItem.classList.add("problem-item");
            problemItem.innerHTML = `
                <span><strong>${problem.platformName}</strong>: <a href="${problem.problemUrl}" target="_blank">${problem.problemName}</a></span>
                <div>
                    <button class="show-notes-btn" data-primary-key="${primaryKey}">Show Notes</button>
                    <button class="delete-btn" data-primary-key="${primaryKey}">Delete</button>
                </div>
            `;
            problemListContainer.appendChild(problemItem);
        }
    }

    // Add event listeners to Show Notes and Delete buttons
    const showNotesButtons = document.querySelectorAll(".show-notes-btn");
    const deleteButtons = document.querySelectorAll(".delete-btn");

    showNotesButtons.forEach(button => {
        button.addEventListener("click", showNotes);
    });

    deleteButtons.forEach(button => {
        button.addEventListener("click", deleteProblem);
    });
}

// Function to display notes for a specific problem
async function showNotes(event) {
    const primaryKey = event.target.dataset.primaryKey;
    const problemMap = await getProblemList();
    const problem = problemMap[primaryKey];

    // Hide the problem list and show the notes container
    document.getElementById("problem-list").style.display = "none";
    document.getElementById("download-csv").style.display = "none";
    const notesContainer = document.getElementById("problem-notes-container");
    notesContainer.classList.add("active");

    // Set the title and content of the notes
    document.querySelector("#problem-notes-title a").textContent = problem.problemName;
    document.querySelector("#problem-notes-title a").href = problem.problemUrl;
    document.getElementById("problem-notes-content").textContent = problem.notes;
}

// Function to delete a specific problem
async function deleteProblem(event) {
    const primaryKey = event.target.dataset.primaryKey;
    const problemMap = await getProblemList();

    // Delete the problem from the map
    delete problemMap[primaryKey];

    // Save the updated problem list back to chrome.storage
    chrome.storage.local.set({ [trackerKey]: problemMap }, () => {
        // Re-render the problem list after deletion
        displayProblems();
    });
}

// Event listener for the Back button
document.getElementById("back-button").addEventListener("click", () => {
    document.getElementById("problem-list").style.display = "block";
    document.getElementById("download-csv").style.display = "block";
    document.getElementById("problem-notes-container").classList.remove("active");
    document.getElementById("problem-notes-content").textContent = "";
    document.querySelector("#problem-notes-title a").href = "#";
    document.querySelector("#problem-notes-title a").textContent = "";
});

// Event listener for the Download CSV button
document.getElementById("download-csv").addEventListener("click", downloadCSV);

// Call the displayProblems function when the popup loads
displayProblems();
