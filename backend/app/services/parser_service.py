import pdfplumber
import json
import os
import tiktoken
import pandas as pd
import io
import base64
from typing import Dict, Any, List

class UnifiedParser:
    def __init__(self):
        self.encoder = tiktoken.get_encoding("cl100k_base")

    async def parse(self, file_path: str, strategy: str, file_extension: str, chunking_strategy: str = "semantic", is_independent_pages: bool = True) -> Dict[str, Any]:
        from fastapi.concurrency import run_in_threadpool
        
        if file_extension.lower() == "docx":
            result = await run_in_threadpool(self._parse_with_docling, file_path)
        elif strategy == "docling" or (strategy == "auto" and self._detect_complex_layout(file_path)):
            result = await run_in_threadpool(self._parse_with_docling, file_path)
        else:
            result = await run_in_threadpool(self._parse_with_pdfplumber, file_path)

        # Post-processing: Chunking and Analytics
        processed_result = self._post_process(result, chunking_strategy)
        return processed_result

    def _detect_complex_layout(self, file_path: str) -> bool:
        return False

    def _count_tokens(self, text: str) -> int:
        return len(self.encoder.encode(text))

    def _post_process(self, result: Dict[str, Any], chunking_strategy: str) -> Dict[str, Any]:
        markdown = result.get("markdown", "")
        chunks = result.get("chunks", [])
        
        # 1. Advanced Chunking
        if chunking_strategy == "fixed":
            final_chunks = self._chunk_fixed(markdown, size=1000, overlap=100)
        elif chunking_strategy == "semantic":
            final_chunks = self._chunk_semantic(markdown)
        else:
            final_chunks = chunks

        # 2. Analytics
        table_count = sum(1 for c in chunks if c.get("type") == "table")
        total_tokens = self._count_tokens(markdown)
        
        analytics = {
            "total_tokens": total_tokens,
            "table_count": table_count,
            "character_count": len(markdown),
            "chunk_count": len(final_chunks),
            "complexity_score": self._calculate_complexity(markdown, table_count)
        }

        # 3. Table Export (Base64 Excel)
        excel_base64 = self._generate_table_excel(chunks)

        return {
            "markdown": markdown,
            "chunks": final_chunks,
            "analytics": analytics,
            "table_export": excel_base64,
            "metadata": result.get("metadata", {})
        }

    def _chunk_fixed(self, text: str, size: int, overlap: int) -> List[Dict[str, Any]]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + size
            chunks.append({
                "content": text[start:end],
                "type": "text_chunk",
                "tokens": self._count_tokens(text[start:end])
            })
            start += size - overlap
        return chunks

    def _chunk_semantic(self, text: str) -> List[Dict[str, Any]]:
        # Simple header-based semantic chunking
        import re
        sections = re.split(r'(^#+\s.*)', text, flags=re.MULTILINE)
        chunks = []
        current_chunk = ""
        
        for part in sections:
            if not part.strip(): continue
            if re.match(r'^#+\s.*', part):
                if current_chunk:
                    chunks.append({"content": current_chunk.strip(), "type": "semantic_block", "tokens": self._count_tokens(current_chunk)})
                current_chunk = part
            else:
                current_chunk += part
        
        if current_chunk:
            chunks.append({"content": current_chunk.strip(), "type": "semantic_block", "tokens": self._count_tokens(current_chunk)})
        
        return chunks

    def _calculate_complexity(self, text: str, table_count: int) -> int:
        # Score 1-10
        score = min(5, table_count) + min(5, len(text) // 5000)
        return max(1, min(10, score))

    def _generate_table_excel(self, chunks: List[Dict[str, Any]]) -> str:
        tables = [c["content"] for c in chunks if c.get("type") == "table"]
        if not tables: return ""
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            for i, table_data in enumerate(tables):
                if not table_data: continue
                df = pd.DataFrame(table_data[1:], columns=table_data[0])
                df.to_sheet = writer # This is just to satisfy the API
                df.to_excel(writer, sheet_name=f'Table_{i+1}', index=False)
        
        excel_data = output.getvalue()
        return base64.b64encode(excel_data).decode('utf-8')

    def _parse_with_pdfplumber(self, file_path: str) -> Dict[str, Any]:
        from app.core.logger import logger
        markdown_output = ""
        chunks = []
        
        try:
            with pdfplumber.open(file_path) as pdf:
                logger.info(f"Opening PDF with pdfplumber: {file_path}, Pages: {len(pdf.pages)}")
                
                for i, page in enumerate(pdf.pages):
                    page_num = i + 1
                    text = page.extract_text()
                    tables = page.extract_tables()
                    
                    markdown_output += f"## Page {page_num}\n\n"
                    
                    if text:
                        markdown_output += text + "\n\n"
                        chunks.append({"page": page_num, "content": text, "type": "text"})
                    
                    if tables:
                        for idx, table in enumerate(tables):
                            clean_table = [[str(cell) if cell is not None else "" for cell in row] for row in table]
                            if not clean_table: continue
                            
                            table_md = f"**Table {idx+1} on Page {page_num}**\n\n"
                            table_md += "| " + " | ".join(clean_table[0]) + " |\n"
                            table_md += "| " + " | ".join(["---"] * len(clean_table[0])) + " |\n"
                            for row in clean_table[1:]:
                                table_md += "| " + " | ".join(row) + " |\n"
                            table_md += "\n"
                            
                            markdown_output += table_md
                            chunks.append({"page": page_num, "content": clean_table, "type": "table"})
                            
        except Exception as e:
            logger.error(f"Error in pdfplumber processing: {e}")
            raise e

        return {"markdown": markdown_output, "chunks": chunks, "metadata": {"parser": "pdfplumber"}}

    def _parse_with_docling(self, file_path: str) -> Dict[str, Any]:
        try:
            from docling.document_converter import DocumentConverter
            converter = DocumentConverter()
            result = converter.convert(file_path)
            markdown_output = result.document.export_to_markdown()
            return {
                "markdown": markdown_output,
                "chunks": [{"content": markdown_output, "type": "mixed"}],
                "metadata": {"parser": "docling"}
            }
        except Exception as e:
            return {"error": str(e), "markdown": "", "chunks": []}
