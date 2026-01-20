from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from app.services.parser_service import UnifiedParser
from app.core.logger import logger
from typing import Optional, List
import shutil
import os
import uuid
import time
import json
import io
import zipfile

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    strategy: str = Form("auto"),
    chunking_strategy: str = Form("semantic"),
    is_independent_pages: bool = Form(True)
):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    try:
        logger.info(f"[{request_id}] Starting parsing request for file: {file.filename}, Strategy: {strategy}")
        
        # Save uploaded file temporarily
        file_extension = file.filename.split(".")[-1]
        temp_filename = f"{request_id}.{file_extension}"
        temp_file_path = os.path.join(UPLOAD_DIR, temp_filename)
        
        logger.info(f"[{request_id}] Saving temp file to {temp_file_path}")
        
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Parse the document
        parser = UnifiedParser()
        result = await parser.parse(
            temp_file_path, 
            strategy=strategy, 
            chunking_strategy=chunking_strategy,
            file_extension=file_extension,
            is_independent_pages=is_independent_pages
        )
        
        duration = time.time() - start_time
        logger.info(f"[{request_id}] Parsing completed successfully in {duration:.2f}s")
        
        # Cleanup
        try:
            os.remove(temp_file_path)
            logger.info(f"[{request_id}] Cleaned up temp file")
        except Exception as cleanup_error:
            logger.warning(f"[{request_id}] Failed to cleanup temp file: {cleanup_error}")
        
        # Add filename to result for batch identification
        result["filename"] = file.filename
        return result
    except Exception as e:
        logger.error(f"[{request_id}] Parsing error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse-batch")
async def parse_batch(
    files: List[UploadFile] = File(...),
    strategy: str = Form("auto"),
    chunking_strategy: str = Form("semantic"),
    is_independent_pages: bool = Form(True)
):
    batch_id = str(uuid.uuid4())
    logger.info(f"[{batch_id}] Starting batch parsing for {len(files)} files")
    results = []
    
    for file in files:
        try:
            # We reuse the logic for single file parsing
            # In a production app, we would use a task queue (Celery) or asyncio.gather
            # For simplicity and to avoid overwhelming resources, we process sequentially here
            # But we'll add the filename to each result
            res = await parse_document(file, strategy, chunking_strategy, is_independent_pages)
            results.append(res)
        except Exception as e:
            logger.error(f"Failed to parse {file.filename} in batch: {e}")
            results.append({
                "filename": file.filename,
                "error": str(e),
                "markdown": "",
                "chunks": []
            })
            
    return results

@router.post("/download-zip")
async def download_zip(results: List[dict]):
    """Create a zip file from the parsing results"""
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for i, res in enumerate(results):
            filename = res.get("filename", f"document_{i+1}")
            base_name = os.path.splitext(filename)[0]
            
            # Save Markdown
            zip_file.writestr(f"{base_name}/{base_name}.md", res.get("markdown", ""))
            
            # Save Raw JSON
            zip_file.writestr(f"{base_name}/{base_name}_raw.json", json.dumps(res, indent=2))
            
            # Save Chunks JSON
            zip_file.writestr(f"{base_name}/{base_name}_chunks.json", json.dumps(res.get("chunks", []), indent=2))
            
            # Save Table Excel if exists
            if res.get("table_export"):
                import base64
                excel_data = base64.b64decode(res["table_export"])
                zip_file.writestr(f"{base_name}/{base_name}_tables.xlsx", excel_data)
                
    zip_buffer.seek(0)
    return Response(
        zip_buffer.getvalue(),
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=parsed_results_{int(time.time())}.zip"}
    )
