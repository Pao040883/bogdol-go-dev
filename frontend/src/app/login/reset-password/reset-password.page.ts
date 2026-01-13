import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonImg,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonText,
  IonButton,
  IonFooter,
  IonInput,
} from '@ionic/angular/standalone';
import { AuthService } from 'src/app/core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [
    IonFooter,
    IonImg,
    IonText,
    ReactiveFormsModule,
    IonCardSubtitle,
    IonButton,
    IonItem,
    IonInput,
    IonCardContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonToolbar,
    CommonModule,
    FormsModule,
    RouterLink,
  ],
})
export class ResetPasswordPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  errorMessage = '';

  resetForm = this.fb.group({
    email: ['', Validators.required],
  });

  constructor() {}

  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit() {
    this.authService.resetPassword(this.resetForm.value.email!).subscribe({
      next: () => this.toastService.success('Falls vorhanden, wurde ein Reset-Link gesendet.'),
      error: (err) => this.toastService.error('Fehler: ' + (err.error?.message || err.message)),
    });
  }
}
