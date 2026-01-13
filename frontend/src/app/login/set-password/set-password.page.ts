import { Component, inject, OnInit, signal } from '@angular/core';
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
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonText,
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonImg,
  IonFooter,
} from '@ionic/angular/standalone';
import { AuthService } from 'src/app/core/services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-set-password',
  templateUrl: './set-password.page.html',
  styleUrls: ['./set-password.page.scss'],
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
    IonInputPasswordToggle,
    IonContent,
    IonHeader,
    IonToolbar,
    CommonModule,
    FormsModule,
  ],
})
export class SetPasswordPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  errorMessage = '';

  resetForm = this.fb.group({
    password1: ['', Validators.required],
    password2: ['', Validators.required],
  });

  constructor() {}

  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit() {
    const { password1, password2 } = this.resetForm.value;
    const uid = this.route.snapshot.paramMap.get('uid')!;
    const token = this.route.snapshot.paramMap.get('token')!;

    if (!password1 || !password2) {
      this.errorMessage = 'Bitte beide Passwörter eingeben.';
      return;
    }

    this.authService
      .resetPasswordConfirm(uid, token, password1, password2)
      .subscribe({
        next: (message) => {
          this.errorMessage = message;
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.error =
            err.error?.error || 'Fehler beim Zurücksetzen des Passworts.';
        },
      });
  }
}
