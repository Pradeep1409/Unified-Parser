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
    strategy: string = 'auto';
    isIndependentPages: boolean = true;
    isLoading: boolean = false;
    response: ParseResponse | null = null;
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

    constructor(private parserService: ParserService, private sanitizer: DomSanitizer) { }

    onFileSelected(event: any) {
        this.selectedFile = event.target.files[0];
        if (this.selectedFile && this.selectedFile.type === 'application/pdf') {
            this.pdfUrl = window.URL.createObjectURL(this.selectedFile);
        } else {
            this.pdfUrl = null;
        }
    }

    reset() {
        if (this.pdfUrl) window.URL.revokeObjectURL(this.pdfUrl);
        this.selectedFile = null;
        this.pdfUrl = null;
        this.response = null;
        this.progress = 0;
        this.estimatedTimeRemaining = 0;
        this.isLoading = false;
        this.stopProgressSimulation();
        // Reset file input in DOM if needed or rely on *ngIf to unmount
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }

    downloadJson(type: 'raw' | 'chunks' | 'excel') {
        if (!this.response) return;

        if (type === 'excel' && this.response.table_export) {
            const byteCharacters = atob(this.response.table_export);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            this.triggerDownload(blob, 'extracted_tables.xlsx');
            return;
        }

        let data;
        let filename;

        if (type === 'raw') {
            data = this.response;
            filename = 'parsed_data_raw.json';
        } else {
            // In a real app, 'chunks' might be a specific subset or post-processed
            // For now, we will assume 'chunks' key in response is what we want
            data = this.response.chunks;
            filename = 'parsed_data_chunks.json';
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.triggerDownload(blob, filename);
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
        if (!this.selectedFile) return;

        this.isLoading = true;
        this.response = null;
        this.progress = 0;

        // Heuristic: 1MB takes approx 5 seconds (simulated)
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

            // Asymptotic progression up to 90%
            const target = Math.min(90, (currentStep / steps) * 100);
            this.progress = target;

            // Decrement time slightly slower than real time to avoid hitting 0 too early
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

        // Use timeout to unlock to prevent jittering
        setTimeout(() => this.isSyncing = false, 50);
    }
}
