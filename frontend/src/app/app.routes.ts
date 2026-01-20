import { Routes } from '@angular/router';
import { UploadComponent } from './features/upload/upload.component';
import { LandingComponent } from './features/landing/landing.component';
import { NotFoundComponent } from './core/pages/not-found/not-found.component';

export const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'parse', component: UploadComponent },
    { path: '**', component: NotFoundComponent }
];
