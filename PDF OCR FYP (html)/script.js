        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('click', () => fileInput.click());

        /* the first click (the one to open the file explorer) */
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files; 
                alert(`You dropped: ${files[0].name}`);
            }
        });

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");

    const toggleButton = document.getElementById("darkModeToggle");

    if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("darkMode", "enabled");
        if(toggleButton) toggleButton.textContent = "Toggle light mode";
    } else {
        localStorage.setItem("darkMode", "disabled");
        if(toggleButton) toggleButton.textContent = "Toggle dark mode";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const toggleButton = document.getElementById("darkModeToggle");
    if(localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        if(toggleButton) toggleButton.textContent = "Toggle light mode";
    }
});


