from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.parser_service import UnifiedParser
from app.core.logger import logger
from typing import Optional
import shutil
import os
import uuid
import time

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
        
        return result
    except Exception as e:
        logger.error(f"[{request_id}] Parsing error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
