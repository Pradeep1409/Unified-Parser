import { Component, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { ParserService, ParseResponse } from '../../core/services/parser.service';

@Component({
    selector: 'app-upload',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './upload.component.html',
    styleUrls: ['./upload.component.css']
})
export class UploadComponent implements OnDestroy {
    @ViewChild('pdfViewer') pdfViewer!: ElementRef;
    @ViewChild('mdViewer') mdViewer!: ElementRef;

    selectedFile: File | null = null;
    selectedFiles: File[] = [];
    isBatchMode: boolean = false;

    strategy: string = 'auto';
    isIndependentPages: boolean = true;
    isLoading: boolean = false;
    response: ParseResponse | null = null;
    batchResults: ParseResponse[] = [];
    activeTab: 'preview' | 'raw' | 'chunks' | 'analytics' = 'preview';
    showCompareModal: boolean = false;
    isSyncing: boolean = false; // Prevent infinite loop

    // Progress logic
    progress: number = 0;
    estimatedTimeRemaining: number = 0;
    private progressInterval: any;

    // Advanced Chunking
    chunkingStrategy: string = 'semantic'; // semantic, fixed, none
    pdfUrl: string | null = null;

    // Batch specific
    processedCount: number = 0;
    totalFiles: number = 0;
    currentFilename: string = '';
    private socket: WebSocket | null = null;
    private clientId: string = Math.random().toString(36).substring(7);

    constructor(private parserService: ParserService, private sanitizer: DomSanitizer) { }

    onFileSelected(event: any) {
        const files = event.target.files;
        if (files.length > 1) {
            this.isBatchMode = true;
            this.selectedFiles = Array.from(files);
            this.selectedFile = null;
            this.pdfUrl = null;
        } else if (files.length === 1) {
            this.isBatchMode = false;
            this.selectedFile = files[0];
            this.selectedFiles = [];
            if (this.selectedFile && this.selectedFile.type === 'application/pdf') {
                this.pdfUrl = window.URL.createObjectURL(this.selectedFile);
            } else {
                this.pdfUrl = null;
            }
        }
    }

    reset() {
        if (this.pdfUrl) window.URL.revokeObjectURL(this.pdfUrl);
        this.selectedFile = null;
        this.selectedFiles = [];
        this.isBatchMode = false;
        this.pdfUrl = null;
        this.response = null;
        this.batchResults = [];
        this.progress = 0;
        this.estimatedTimeRemaining = 0;
        this.isLoading = false;
        this.processedCount = 0;
        this.totalFiles = 0;
        this.stopProgressSimulation();
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }

    downloadJson(type: 'raw' | 'chunks' | 'excel', dataOverride?: any) {
        const resp = dataOverride || this.response;
        if (!resp) return;

        if (type === 'excel' && resp.table_export) {
            const byteCharacters = atob(resp.table_export);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            this.triggerDownload(blob, `${resp.filename || 'extracted'}_tables.xlsx`);
            return;
        }

        let data;
        let filename;

        if (type === 'raw') {
            data = resp;
            filename = `${resp.filename || 'parsed'}_raw.json`;
        } else {
            data = resp.chunks;
            filename = `${resp.filename || 'parsed'}_chunks.json`;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.triggerDownload(blob, filename);
    }

    downloadAllZip() {
        if (this.batchResults.length === 0) return;
        this.parserService.downloadZip(this.batchResults).subscribe(blob => {
            this.triggerDownload(blob, `batch_results_${Date.now()}.zip`);
        });
    }

    private triggerDownload(blob: Blob, filename: string) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    onUpload() {
        if (this.isBatchMode) {
            this.startBatchUpload();
        } else {
            this.startSingleUpload();
        }
    }

    private startSingleUpload() {
        if (!this.selectedFile) return;

        this.isLoading = true;
        this.response = null;
        this.progress = 0;

        const fileSizeMB = this.selectedFile.size / (1024 * 1024);
        const estimatedSeconds = Math.max(3, Math.ceil(fileSizeMB * 5));
        this.estimatedTimeRemaining = estimatedSeconds;

        this.startProgressSimulation(estimatedSeconds);

        this.parserService.parseDocument(this.selectedFile, this.strategy, this.isIndependentPages, this.chunkingStrategy)
            .subscribe({
                next: (res) => {
                    this.isLoading = false;
                    this.response = res;
                    this.stopProgressSimulation();
                    this.progress = 100;
                },
                error: (err) => {
                    this.isLoading = false;
                    this.stopProgressSimulation();
                    console.error(err);
                    alert('Error parsing document');
                }
            });
    }

    private startBatchUpload() {
        if (this.selectedFiles.length === 0) return;

        this.isLoading = true;
        this.batchResults = [];
        this.progress = 0;
        this.totalFiles = this.selectedFiles.length;
        this.processedCount = 0;

        const totalSizeMB = this.selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024);
        const estimatedSeconds = Math.max(5, Math.ceil(totalSizeMB * 4));
        this.estimatedTimeRemaining = estimatedSeconds;

        // For batches, we use real-time progress instead of simulation
        // this.startProgressSimulation(estimatedSeconds);

        // Connect to WebSocket for real-time updates
        this.socket = this.parserService.connectToProgress(this.clientId);
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
                this.progress = data.percentage;
                this.processedCount = data.current;
                this.currentFilename = data.filename;
            } else if (data.type === 'finish') {
                this.progress = 100;
                this.currentFilename = 'Complete';
            }
        };

        this.parserService.parseBatch(this.selectedFiles, this.strategy, this.isIndependentPages, this.chunkingStrategy, this.clientId)
            .subscribe({
                next: (res) => {
                    this.isLoading = false;
                    this.batchResults = res;
                    this.stopProgressSimulation();
                    this.progress = 100;
                    this.processedCount = res.length;
                    // Auto-select first result to show preview if possible
                    if (res.length > 0) {
                        this.viewBatchResult(0);
                    }
                    if (this.socket) {
                        this.socket.close();
                        this.socket = null;
                    }
                },
                error: (err) => {
                    this.isLoading = false;
                    this.stopProgressSimulation();
                    console.error(err);
                    alert('Error parsing batch');
                    if (this.socket) {
                        this.socket.close();
                        this.socket = null;
                    }
                }
            });
    }

    viewBatchResult(index: number) {
        this.response = this.batchResults[index];
        // If it's a PDF, we might not have the URL if we didn't store it
        // For simplicity, we assume we only preview the text/markdown in batch mode
        // but we could match the file if needed.
        const originalFile = this.selectedFiles.find(f => f.name === this.response?.filename);
        if (originalFile && originalFile.type === 'application/pdf') {
            if (this.pdfUrl) window.URL.revokeObjectURL(this.pdfUrl);
            this.pdfUrl = window.URL.createObjectURL(originalFile);
        } else {
            this.pdfUrl = null;
        }
    }

    getGlobalAnalytics() {
        return {
            totalFiles: this.batchResults.length,
            totalTokens: this.batchResults.reduce((acc, r) => acc + (r.analytics?.total_tokens || 0), 0),
            totalChunks: this.batchResults.reduce((acc, r) => acc + (r.analytics?.chunk_count || 0), 0),
            avgComplexity: (this.batchResults.reduce((acc, r) => acc + (r.analytics?.complexity_score || 0), 0) / (this.batchResults.length || 1)).toFixed(1)
        };
    }

    getSafePdfUrl() {
        return this.pdfUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl) : null;
    }

    private startProgressSimulation(durationSeconds: number) {
        this.stopProgressSimulation();
        const intervalMs = 200;
        const steps = (durationSeconds * 1000) / intervalMs;
        let currentStep = 0;

        this.progressInterval = setInterval(() => {
            currentStep++;
            const target = Math.min(95, (currentStep / steps) * 100);
            this.progress = target;
            if (currentStep % 5 === 0 && this.estimatedTimeRemaining > 1) {
                this.estimatedTimeRemaining--;
            }
        }, intervalMs);
    }

    private stopProgressSimulation() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    ngOnDestroy() {
        this.stopProgressSimulation();
        if (this.pdfUrl) window.URL.revokeObjectURL(this.pdfUrl);
        if (this.socket) this.socket.close();
    }

    formatTime(seconds: number): string {
        return `${seconds}s`;
    }

    setActiveTab(tab: 'preview' | 'raw' | 'chunks' | 'analytics') {
        this.activeTab = tab;
    }

    onScrollSync(source: 'pdf' | 'md') {
        if (this.isSyncing) return;
        const pdf = this.pdfViewer?.nativeElement;
        const md = this.mdViewer?.nativeElement;
        if (!pdf || !md) return;
        this.isSyncing = true;
        if (source === 'pdf') {
            const percentage = pdf.scrollTop / (pdf.scrollHeight - pdf.clientHeight);
            md.scrollTop = percentage * (md.scrollHeight - md.clientHeight);
        } else {
            const percentage = md.scrollTop / (md.scrollHeight - md.clientHeight);
            pdf.scrollTop = percentage * (pdf.scrollHeight - pdf.clientHeight);
        }
        setTimeout(() => this.isSyncing = false, 50);
    }
}
