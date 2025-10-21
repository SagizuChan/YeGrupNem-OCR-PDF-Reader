const file_input = document.getElementById('file_input');
const progressBar = document.querySelector('.progress-bar');
const stateText = document.querySelector('.state');
const percentageText = document.querySelector('.percentage');
const loadingArea = document.querySelector('.loading_area');
// Extracted loader usage (non-breaking; keeps existing DOM updates as fallback)
let loader = null;
document.addEventListener('DOMContentLoaded', () => {
    if (window.createLoading) {
        loader = window.createLoading(loadingArea);
        loader.reset();
    }
});

//Function that makes porccesses pause
function sleep(second) {
    return new Promise(resolve => setTimeout(resolve, second*1000));
}

function change_page(){
    window.location.href = "image_to_text_text.html";
}

// Converts Image to text
function conversion() {
    file_input.addEventListener('change', async function(event) {
        const file = event.target.files;
        if (file.length > 0) {
            const selectedFile = file[0];
            const reader = new FileReader();

            reader.onload = function(e) {
                const file_data = e.target.result;
 
                if (loader) { loader.reset(); loader.show(); loader.setStatus('Starting...'); loader.setProgress(0); }
                else {
                    if (loadingArea) loadingArea.style.display = 'flex';
                    if (progressBar) progressBar.style.width = '0%';
                    if (stateText) stateText.textContent = 'Starting...';
                    if (percentageText) percentageText.textContent = '0%';
                }
 
                Tesseract.recognize(file_data, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            let progress = (m.progress * 100).toFixed(0);
                            if (loader) { loader.setStatus(m.status); loader.setProgress(progress); }
                            else {
                                if (progressBar) progressBar.style.width = `${progress}%`;
                                if (stateText) stateText.textContent = m.status;
                                if (percentageText) percentageText.textContent = `${progress}%`;
                            }
                        }
                    }
                }).then(({ data: { text } }) => {
                    console.log('OCR Result:\n', text);
                    if (loader) { loader.setStatus('Completed!'); loader.setProgress(100); }
                    else {
                        if (stateText) stateText.textContent = 'Completed!';
                        if (percentageText) percentageText.textContent = '100%';
                        if (progressBar) progressBar.style.width = '100%';
                    }
                     try { localStorage.setItem('ocr_text', text); } catch (e) { /* ignore */ }
                     setTimeout(change_page, 200)
                }).catch(err => {
                    console.error('OCR Error:', err);
                    if (loader) { loader.setStatus('Error!'); loader.setProgress(0); }
                    else {
                        if (stateText) stateText.textContent = 'Error!';
                        if (percentageText) percentageText.textContent = '0%';
                        if (progressBar) progressBar.style.width = '0%';
                    }
                });
            }

            reader.readAsDataURL(selectedFile);
            file_input.value = '';
        }
    });
}

function open_file() {
    file_input.click();
    conversion();
}

// ===== UI helpers for displaying OCR text and downloads =====
document.addEventListener('DOMContentLoaded', () => {
    // populate display if OCR text was stored
    const ocrTextArea = document.getElementById('ocr_text');
    const stored = (() => { try { return localStorage.getItem('ocr_text'); } catch(e){return null;} })();
    if (ocrTextArea && stored) {
        ocrTextArea.value = stored;
    }

    // wire buttons if present
    const btnTxt = document.getElementById('download_txt');
    const btnDoc = document.getElementById('download_doc');
    const btnPdf = document.getElementById('download_pdf');
    const btnCopy = document.getElementById('copy_text');
    // const btnClear = document.getElementById('clear_text');

    function getText() {
        return (ocrTextArea && ocrTextArea.value) || (localStorage.getItem && localStorage.getItem('ocr_text')) || '';
    }

    if (btnTxt) btnTxt.addEventListener('click', () => {
        const text = getText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ocr.txt';
        document.body.appendChild(a); a.click(); a.remove();
    });

    if (btnDoc) btnDoc.addEventListener('click', () => {
        const text = getText();
        // simple Word-compatible HTML/doc export (opens in Word)
        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
        const footer = "</body></html>";
        const blob = new Blob([header + text.replace(/\n/g, '<br>') + footer], { type: 'application/msword' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ocr.docx';
        document.body.appendChild(a); a.click(); a.remove();
    });

    if (btnPdf) btnPdf.addEventListener('click', () => {
        const text = getText() || '';
        if (window.jspdf && window.jspdf.jsPDF) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const lines = doc.splitTextToSize(text, 180);
            doc.text(lines, 10, 10);
            doc.save('ocr.pdf');
        } else if (window.jsPDF) {
            const doc = new window.jsPDF();
            const lines = doc.splitTextToSize(text, 180);
            doc.text(lines, 10, 10);
            doc.save('ocr.pdf');
        } else {
            const blob = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ocr.pdf';
            document.body.appendChild(a); a.click(); a.remove();
        }
    });

    if (btnCopy) btnCopy.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(getText());
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = getText();
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
    });

    // Make textarea read-only by default and add Edit/Done toggle
    if (ocrTextArea) {
        ocrTextArea.readOnly = true;
    }
    const btnEdit = document.getElementById('edit_text');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            if (!ocrTextArea) return;
            if (ocrTextArea.readOnly) {
                ocrTextArea.readOnly = false;
                ocrTextArea.focus();
                btnEdit.textContent = 'Done';
            } else {
                ocrTextArea.readOnly = true;
                btnEdit.textContent = 'Edit';
                try { localStorage.setItem('ocr_text', ocrTextArea.value); } catch (e) {}
            }
        });
    }
});

