<<<<<<< HEAD
# 📄 Unified Parser: Enterprise Document Intelligence


**Unified Parser** is a high-performance, SaaS-ready document processing engine designed to transform unstructured PDF and DOCX files into LLM-optimized Markdown and structured JSON. Built with an "AI-First" approach, it features intelligent layout detection, semantic chunking, and real-time document analytics.

---

## 🚀 Key Features

### 🧠 Intelligent Parsing Engine
*   **Multi-Engine Strategy**: Automatically switches between `pdfplumber` (for structured tables/text) and `docling` (for complex, borderless layouts).
*   **Side-by-Side Review**: Comparative split-view UI to verify parsed Markdown against the original document in real-time.
*   **Table Extraction**: High-fidelity table detection with direct export to **formatted Excel (.xlsx)** sheets.

### ✂️ Advanced Chunking for RAG
*   **Semantic Chunking**: Context-aware splitting based on document headers and logical sections.
*   **Recursive Fixed-Size**: Standard windowing with overlap to maintain text continuity.
*   **Token Optimization**: Real-time token counting using OpenAI's `tiktoken` (cl100k_base) to ensure compatibility with GPT-4 and Gemini.

### 📊 Real-time Analytics
*   **Token Metrics**: Instant calculation of total tokens for LLM cost estimation.
*   **Layout Complexity**: Automated scoring (1-10) of document structural difficulty.
*   **Structural Breakdown**: Dynamic tracking of detected tables, text nodes, and chunk density.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Angular 18+, Tailwind CSS v4, Lucide Icons, Glassmorphism UI |
| **Backend** | FastAPI, Python 3.10+, Uvicorn |
| **Parsing** | Pdfplumber, Docling (IBM-powered), Pandas |
| **LLM Prep** | Tiktoken, Semantic Regex Chunking |

---

## 🛠 Installation & Setup

### 1. Prerequisites
*   Node.js (v18+)
*   Python (3.10+)

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
ng serve
```

---

## 📖 Usage Guide
1.  **Landing Page**: Explore the platform and click "Get Started".
2.  **Upload**: Select a PDF or DOCX file (up to 50MB).
3.  **Configure**:
    *   Choose **Docling** for complex layouts or **PDFPlumber** for standard forms.
    *   Select a **Semantic** chunking strategy for better RAG performance.
4.  **Parse**: Click "Run Parser" and watch the real-time progress bar.
5.  **Export**: Download the **Raw JSON**, **Clean Chunks**, or the **Excel Table Export**.

---

## 📂 Project Structure
```text
├── backend
│   ├── app
│   │   ├── api         # FastAPI Route definitions
│   │   ├── core        # Logging & Configuration
│   │   └── services    # UnifiedParser & Post-processing logic
│   └── logs            # Structural application logs
├── frontend
│   ├── src/app
│   │   ├── core        # Services & Application config
│   │   └── features    # Dashboard, Landing, & Upload components
│   └── src/assets      # Global styles & assets
└── README.md
```

---

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a pull request for any feature additions or bug fixes.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
=======
 
>>>>>>> origin/main
