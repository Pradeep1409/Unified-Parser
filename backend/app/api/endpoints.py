from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, WebSocket, WebSocketDisconnect
from app.services.parser_service import UnifiedParser
from app.core.logger import logger
from typing import Optional, List, Dict
import shutil
import os
import uuid
import time
import json
import io
import zipfile
import asyncio

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected for progress updates")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")

    async def send_progress(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending progress to {client_id}: {e}")
                self.disconnect(client_id)

manager = ConnectionManager()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(client_id, websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)

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
    is_independent_pages: bool = Form(True),
    client_id: Optional[str] = Form(None)
):
    batch_id = str(uuid.uuid4())
    total_files = len(files)
    logger.info(f"[{batch_id}] Starting batch parsing for {total_files} files")
    results = []
    
    for i, file in enumerate(files):
        try:
            current_progress = int(((i) / total_files) * 100)
            if client_id:
                await manager.send_progress(client_id, {
                    "type": "progress",
                    "batch_id": batch_id,
                    "filename": file.filename,
                    "current": i + 1,
                    "total": total_files,
                    "percentage": current_progress,
                    "status": "processing"
                })

            res = await parse_document(file, strategy, chunking_strategy, is_independent_pages)
            results.append(res)
            
            # Send completion update for this file
            if client_id:
                await manager.send_progress(client_id, {
                    "type": "progress",
                    "batch_id": batch_id,
                    "filename": file.filename,
                    "current": i + 1,
                    "total": total_files,
                    "percentage": int(((i + 1) / total_files) * 100),
                    "status": "completed"
                })

        except Exception as e:
            logger.error(f"Failed to parse {file.filename} in batch: {e}")
            results.append({
                "filename": file.filename,
                "error": str(e),
                "markdown": "",
                "chunks": []
            })
            
    if client_id:
        await manager.send_progress(client_id, {
            "type": "finish",
            "batch_id": batch_id,
            "total": total_files,
            "status": "all_completed"
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
