import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      
      <!-- Background Gradients -->
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/30 rounded-full blur-[100px] pointer-events-none animate-blob"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none animate-blob animation-delay-2000"></div>

      <!-- Navigation -->
      <nav class="max-w-7xl mx-auto p-6 md:p-8 flex justify-between items-center relative z-10">
        <div class="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Unified Parser
        </div>
        <a href="https://github.com/your-repo" target="_blank" class="text-slate-400 hover:text-white transition-colors">
            GitHub
        </a>
      </nav>

      <!-- Hero Section -->
      <div class="max-w-5xl mx-auto px-6 md:px-12 pt-12 md:pt-24 text-center relative z-10">
        <div class="inline-block mb-6 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium animate-fade-in-up">
          New: Intelligent Layout Detection
        </div>
        
        <h1 class="text-6xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent drop-shadow-lg">
          Transform Documents <br/> into <span class="text-indigo-500">Actionable Data</span>
        </h1>
        
        <p class="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Unlock the potential of your PDFs and DOCXs with our advanced parsing engine. 
          Seamlessly extract tables, text, and structure for your LLM workflows.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a routerLink="/parse" class="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white font-bold text-lg shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 overflow-hidden">
            <span class="relative z-10 flex items-center gap-2">
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
            <div class="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
        </div>

      </div>
    </div>
  `,
  styles: [`
    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-blob {
      animation: blob 7s infinite;
    }
    .animation-delay-2000 {
      animation-delay: 2s;
    }
  `]
})
export class LandingComponent { }
