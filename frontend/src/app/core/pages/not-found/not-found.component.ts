import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
     <div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <div class="relative mb-8">
            <h1 class="text-9xl font-black text-slate-800 select-none">404</h1>
            <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-2xl md:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Page Not Found
                </span>
            </div>
        </div>
        <p class="text-slate-400 text-lg mb-8 max-w-md">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <a routerLink="/" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-indigo-500/25">
            Go Back Home
        </a>
     </div>
  `
})
export class NotFoundComponent { }
