console.log("Popup script loaded");

const trackerKey = "1234567890";
const REVISION_KEY = 'daily_revisions';
async function getDailyRevisions() {
    try {
        // Get current revision data from storage
        const revisionData = await new Promise(resolve => {
            chrome.storage.local.get([REVISION_KEY], result => {
                resolve(result[REVISION_KEY] || { problems: [], date: '' });
            });
        });
        
        const today = new Date().toISOString().split('T')[0];
        const problemMap = await getProblemList();
        
        // Check if we need new revisions
        if (revisionData.problems.length ===0 || revisionData.date !== today) {
            console.log("Generating new revision list for today");
            const problems = Object.entries(problemMap) ;
            
            if (problems.length === 0) {
                console.log("No problems found for revision");
                return [];
            }

            let problemsWithDays = [];
            for (const [key, value] of problems) {
                let problem = value;
                const lastRevised = problem.lastRevised ? new Date(problem.lastRevised) : null;
                const daysSinceRevision = lastRevised 
                    ? Math.floor((new Date() - lastRevised) / (1000 * 60 * 60 * 24))
                    : Infinity;

                const weight = calculateRevisionWeight(problem.revisions || 0, daysSinceRevision)
                problemsWithDays.push({
                    ...problem,
                    weight,
                    daysSinceRevision,
                   key
                });
            }
            
            
            // Get top 5 problems by weight
            const selectedProblems = problemsWithDays
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 5);

                console.log("Selected problems for revision:", selectedProblems);

            // Save new revision data with primary keys
            const newRevisionData = {
                problems: selectedProblems.map(p => `${p.key}`),
                date: today
            };
            
            await new Promise(resolve => {
                chrome.storage.local.set({ [REVISION_KEY]: newRevisionData }, resolve);
            });
            
            return selectedProblems;
        }
        
        // Return problems from saved primary keys
        console.log("Using cached revision list");
        console.log("Problem map:", problemMap);
        console.log("Revision data:", revisionData);
        return revisionData.problems
            .map(primaryKey => problemMap[primaryKey])
            .filter(Boolean);
            
    } catch (error) {
        console.error("Error getting daily revisions:", error);
        return [];
    }
}

// Helper function to calculate revision weight
function calculateRevisionWeight(revisionCount, daysSinceRevision) {
    // Base weight inversely proportional to revision count
    const revisionWeight = 1 / (1 + revisionCount);
    
    // Time weight increases with days since last revision
    const timeWeight = Math.min(daysSinceRevision / 7, 1); // Caps at 1 week
    
    // Daily rotation factor based on the day of the year
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const rotationFactor = ((dayOfYear + revisionCount) % 3) / 3; // Creates a 3-day rotation cycle
    
    // Combined weight gives priority to less revised problems and those not revised recently
    // The rotationFactor ensures different problems get prioritized each day
    return revisionWeight * (1 + timeWeight) * (1 + rotationFactor);
}

// Update getProblemList function with better error handling
function getProblemList() {
    console.log("Getting problem list...");
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get([trackerKey], function (results) {
                if (chrome.runtime.lastError) {
                    console.error("Storage error:", chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                console.log("Raw storage results:", results);
                console.log("Problem list:", results[trackerKey]);
                resolve(results[trackerKey] || {});
            });
        } catch (error) {
            console.error("Error in getProblemList:", error);
            reject(error);
        }
    });
}

// Function to convert problem data to CSV format
function convertToCSV(data) {
    const headers = ["Platform", "Name", "URL", "Topic", "Status", "Notes", "Revisions", "Last Revised"];
    const rows = Object.values(data).map(problem => [
        `"${problem.platformName}"`,
        `"${problem.problemName}"`,
        `"${problem.problemUrl}"`,
        `"${problem.topic || ''}"`,
        `"${problem.status || 'Not Solved'}"`,
        `"${problem.notes || ''}"`,
        `"${problem.revisions || 0}"`,
        `"${problem.lastRevised ? new Date(problem.lastRevised).toLocaleString() : ''}"`,
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

// Update displayProblems with try-catch
async function displayProblems() {
    console.log("Starting displayProblems...");
    try {
        const problemMap = await getProblemList();
        console.log("Retrieved problem map:", problemMap);
        
        const problemListContainer = document.getElementById("problem-list");
        if (!problemListContainer) {
            console.error("Could not find problem-list element");
            return;
        }

        // Clear the container before displaying the problems
        problemListContainer.innerHTML = "";
        console.log("Cleared problem list container");

        if (Object.keys(problemMap).length === 0) {
            console.log("No problems found in storage");
            document.getElementById("download-csv").style.display = "none";
            problemListContainer.innerHTML = '<p>No problems saved yet.</p>';
        } else {
            console.log(`Found ${Object.keys(problemMap).length} problems`);
            for (let primaryKey in problemMap) {
                const problem = problemMap[primaryKey];
                const problemItem = document.createElement("div");
                problemItem.classList.add("problem-item");
                
                // Add not-solved class if status is "Not Solved"
                if (problem.status === "Not Solved" || !problem.status) {
                    problemItem.classList.add("not-solved");
                }

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
    } catch (error) {
        console.error("Error in displayProblems:", error);
    }
}

// Function to display notes for a specific problem
async function showNotes(event) {
    const primaryKey = event.target.dataset.primaryKey;
    const problemMap = await getProblemList();
    const problem = problemMap[primaryKey];

    
    

    // Hide the problem list and show the notes container
    document.getElementById("show-revisions").style.display = "none";
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

async function displayDailyRevisions() {
    try {
        const dailyRevisions = await getDailyRevisions();
        console.log("Daily revisions:", dailyRevisions);
        const container = document.getElementById('daily-revisions-container');
        
        // Hide other elements
        document.getElementById('problem-list').style.display = 'none';
        document.getElementById('download-csv').style.display = 'none';
        document.getElementById('show-revisions').style.display = 'none';
        
        // Clear and show container
        container.innerHTML = `
            <h3>Today's Revision List</h3>
            ${dailyRevisions.length === 0 
                ? '<p>No problems to revise today.</p>'
                : `<div class="revision-list">
                    ${dailyRevisions.map(problem => `
                        <div class="revision-item">
                            <div class="problem-info">
                                <strong>${problem.platformName}</strong>: 
                                <a href="${problem.problemUrl}" target="_blank">${problem.problemName}</a>
                            </div>
                            <div class="revision-stats">
                                <span>Revisions: ${problem.revisions || 0}</span>
                                ${problem.lastRevised 
                                    ? `<span>Last: ${new Date(problem.lastRevised).toLocaleDateString()}</span>`
                                    : '<span>Never revised</span>'
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>`
            }
            <button id="back-from-revisions">Back to List</button>
        `;
        
        container.style.display = 'block';
        
        // Add event listener to the back button
        document.getElementById('back-from-revisions').addEventListener('click', () => {
            container.style.display = 'none';
            document.getElementById('problem-list').style.display = 'block';
            document.getElementById('download-csv').style.display = 'block';
            document.getElementById('show-revisions').style.display = 'block';
        });
    } catch (error) {
        console.error("Error displaying daily revisions:", error);
    }
}

document.getElementById('show-revisions').addEventListener('click', displayDailyRevisions);
document.getElementById('back-from-revisions').addEventListener('click', () => {
    const container = document.getElementById('daily-revisions-container');
    container.style.display = 'none';
    const dailyRevisionsButton = document.getElementById("show-revisions");
    dailyRevisionsButton.style.display = "block"; // Show the button
    document.getElementById("download-csv").style.display = "block";
    document.getElementById('problem-list').style.display = 'block';
});

// Event listener for the Back button
document.getElementById("back-button").addEventListener("click", () => {
    document.getElementById("problem-list").style.display = "block";
    document.getElementById("download-csv").style.display = "block";
    document.getElementById("problem-notes-container").classList.remove("active");
    document.getElementById("problem-notes-content").textContent = "";
    document.querySelector("#problem-notes-title a").href = "#";
    document.querySelector("#problem-notes-title a").textContent = "";
    const dailyRevisionsButton = document.getElementById("show-revisions");
    dailyRevisionsButton.style.display = "block"; 
});

// Event listener for the Download CSV button
document.getElementById("download-csv").addEventListener("click", downloadCSV);

// Call the displayProblems function when the popup loads
displayProblems();

// Add DOMContentLoaded listener to ensure popup is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded");
    displayProblems();
});

// Add storage change listener to debug storage updates
chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(
            `Storage key "${key}" in namespace "${namespace}" changed:`,
            "Old value:", oldValue,
            "New value:", newValue
        );
    }
});
