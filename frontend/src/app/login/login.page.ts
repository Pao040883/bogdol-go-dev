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
  IonTitle,
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
  IonFooter } from '@ionic/angular/standalone';
import { AuthService } from '../core/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import {MatTooltipModule} from '@angular/material/tooltip';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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
    RouterLink,
    MatTooltipModule
  ],
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {}

  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit() {
    if (this.loginForm.invalid) {
      this.error.set('Bitte fülle alle Felder aus.');
      return;
    }

    const { username, password } = this.loginForm.value;
    this.authService.login(username!, password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const backendMessage =
          err.error?.message || err.error?.detail || 'Login fehlgeschlagen.';
        this.error.set(backendMessage);
      },
    });
  }

}
