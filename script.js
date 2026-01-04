// Ensure the PDF processing libraries are ready
const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loaderText');

// Helper Functions
const showLoader = (txt) => { loaderText.innerText = txt; loader.classList.remove('hidden'); };
const hideLoader = () => { loader.classList.add('hidden'); };

const saveFile = (data, name, isBlob = false) => {
    const blob = isBlob ? data : new Blob([data], {type: "application/pdf"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
};

// Tab Navigation
document.querySelectorAll('.tool-tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('.tool-tab, .tool-section').forEach(el => el.classList.remove('active'));
        t.classList.add('active');
        document.getElementById(t.dataset.tool).classList.add('active');
    });
});

/** * MERGE TOOL LOGIC 
 */
let mergeFiles = [];
const mIn = document.getElementById('mergeIn');
const mList = document.getElementById('mergeList');
const mBtn = document.getElementById('doMerge');
const mDrop = document.getElementById('mergeDrop');

mDrop.addEventListener('click', () => mIn.click());
mIn.addEventListener('change', () => {
    mergeFiles = [...mergeFiles, ...Array.from(mIn.files)];
    renderMergeList();
    mIn.value = ''; 
});

function renderMergeList() {
    mList.innerHTML = mergeFiles.map((f, i) => `
        <div class="flex justify-between items-center p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
            <span class="font-bold text-blue-900 truncate"><i class="far fa-file-pdf mr-2"></i>${f.name}</span>
            <button class="remove-file text-red-500" data-index="${i}"><i class="fas fa-times-circle"></i></button>
        </div>`).join('');
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-file').forEach(btn => {
        btn.onclick = (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            mergeFiles.splice(index, 1);
            renderMergeList();
        };
    });
    mBtn.disabled = mergeFiles.length < 2;
}

mBtn.onclick = async () => {
    showLoader("Merging Documents...");
    try {
        const outPdf = await PDFDocument.create();
        for (const f of mergeFiles) {
            const doc = await PDFDocument.load(await f.arrayBuffer());
            const pages = await outPdf.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => outPdf.addPage(p));
        }
        saveFile(await outPdf.save(), "merged_by_pdftoolbox.pdf");
    } catch(e) { console.error(e); }
    hideLoader();
};

/**
 * SPLIT TOOL LOGIC
 */
const sIn = document.getElementById('splitIn');
const sBtn = document.getElementById('doSplit');
const sDrop = document.getElementById('splitDrop');

sDrop.addEventListener('click', () => sIn.click());
sIn.onchange = () => {
    if(sIn.files[0]) {
        document.getElementById('splitLabel').innerText = sIn.files[0].name;
        sBtn.classList.remove('hidden');
    }
};

sBtn.onclick = async () => {
    showLoader("Splitting PDF Pages...");
    try {
        const zip = new JSZip();
        const doc = await PDFDocument.load(await sIn.files[0].arrayBuffer());
        for (let i = 0; i < doc.getPageCount(); i++) {
            const subDoc = await PDFDocument.create();
            const [p] = await subDoc.copyPages(doc, [i]);
            subDoc.addPage(p);
            zip.file(`Page_${i+1}.pdf`, await subDoc.save());
        }
        const zipBlob = await zip.generateAsync({type:"blob"});
        saveFile(zipBlob, "split_pdf_bundle.zip", true);
    } catch(e) { console.error(e); }
    hideLoader();
};

/**
 * COMPRESS TOOL LOGIC
 */
const cIn = document.getElementById('compIn');
const cBtn = document.getElementById('doComp');
const cDrop = document.getElementById('compDrop');

cDrop.onclick = () => cIn.click();
cIn.onchange = () => {
    if(cIn.files[0]) {
        document.getElementById('compLabel').innerText = cIn.files[0].name;
        cBtn.classList.remove('hidden');
    }
};

cBtn.onclick = async () => {
    showLoader("Optimizing File...");
    try {
        const doc = await PDFDocument.load(await cIn.files[0].arrayBuffer());
        const data = await doc.save({ useObjectStreams: true });
        saveFile(data, "compressed_file.pdf");
    } catch(e) { console.error(e); }
    hideLoader();
};

/**
 * CONVERT TOOL LOGIC
 */
const cvIn = document.getElementById('convIn');
const cvBtn = document.getElementById('doConv');
const cvDrop = document.getElementById('convDrop');

cvDrop.onclick = () => cvIn.click();
cvIn.onchange = () => {
    if(cvIn.files[0]) {
        document.getElementById('convLabel').innerText = cvIn.files[0].name;
        cvBtn.classList.remove('hidden');
    }
};

cvBtn.onclick = async () => {
    showLoader("Extracting Text...");
    try {
        const text = await extractPdfText(await cvIn.files[0].arrayBuffer());
        saveFile(new Blob([text], {type: "text/plain"}), "extracted_text.txt", true);
    } catch(e) { console.error(e); }
    hideLoader();
};

async function extractPdfText(buffer) {
    const pdf = await pdfjsLib.getDocument(buffer).promise;
    let text = "";
    for(let i=1; i<=pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(s => s.str).join(" ") + "\n";
    }
    return text;
}

/**
 * WORD COUNT LOGIC
 */
const wcArea = document.getElementById('wcArea');
const wcPdfIn = document.getElementById('wcPdfIn');
const wcToggles = [document.getElementById('wcToggleText'), document.getElementById('wcTogglePdf')];

wcToggles.forEach(btn => {
    btn.onclick = () => {
        wcToggles.forEach(b => b.classList.remove('active', 'text-blue-600'));
        wcToggles.forEach(b => b.classList.add('text-gray-400'));
        btn.classList.add('active', 'text-blue-600');
        btn.classList.remove('text-gray-400');
        const isPdf = btn.id === 'wcTogglePdf';
        document.getElementById('wcTextContainer').classList.toggle('hidden', isPdf);
        document.getElementById('wcPdfContainer').classList.toggle('hidden', !isPdf);
        runStats(""); // Clear
    };
});

wcArea.addEventListener('input', () => runStats(wcArea.value));
document.getElementById('wcPdfDrop').onclick = () => wcPdfIn.click();
wcPdfIn.onchange = async () => {
    const file = wcPdfIn.files[0];
    if(!file) return;
    document.getElementById('wcPdfLabel').innerText = `Analyzing: ${file.name}`;
    showLoader("Analyzing Document...");
    const text = await extractPdfText(await file.arrayBuffer());
    runStats(text);
    hideLoader();
};

function runStats(str) {
    const val = str.trim();
    document.getElementById('wCount').innerText = val ? val.split(/\s+/).length.toLocaleString() : 0;
    document.getElementById('cCount').innerText = val.length.toLocaleString();
    document.getElementById('sCount').innerText = val.split(/[.!?]+/).filter(Boolean).length.toLocaleString();
    document.getElementById('pCount').innerText = val.split(/\n+/).filter(Boolean).length.toLocaleString();
  }
