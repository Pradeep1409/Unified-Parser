import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ParseResponse {
    markdown: string;
    chunks: any[];
    analytics?: {
        total_tokens: number;
        table_count: number;
        character_count: number;
        chunk_count: number;
        complexity_score: number;
    };
    table_export?: string; // base64 excel
    metadata: any;
}

@Injectable({
    providedIn: 'root'
})
export class ParserService {
    private apiUrl = 'http://localhost:8000/api/parse';

    constructor(private http: HttpClient) { }

    parseDocument(file: File, strategy: string = 'auto', isIndependent: boolean = true, chunkingStrategy: string = 'semantic'): Observable<ParseResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('strategy', strategy);
        formData.append('is_independent_pages', isIndependent.toString());
        formData.append('chunking_strategy', chunkingStrategy);

        return this.http.post<ParseResponse>(this.apiUrl, formData);
    }
}
