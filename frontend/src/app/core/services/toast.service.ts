import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  checkmarkCircleOutline, 
  alertCircleOutline, 
  warningOutline, 
  informationCircleOutline 
} from 'ionicons/icons';

export type ToastPosition = 'top' | 'middle' | 'bottom';
export type ToastColor = 'success' | 'warning' | 'danger' | 'primary' | 'secondary' | 'tertiary' | 'light' | 'medium' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private toastController: ToastController) {
    // Register icons for toasts
    addIcons({
      checkmarkCircleOutline,
      alertCircleOutline,
      warningOutline,
      informationCircleOutline
    });
  }

  /**
   * Show a toast message
   */
  async show(
    message: string,
    options?: {
      duration?: number;
      position?: ToastPosition;
      color?: ToastColor;
      icon?: string;
      buttons?: Array<{ text: string; role?: string; handler?: () => void }>;
    }
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: options?.duration ?? 3000,
      position: options?.position ?? 'bottom',
      color: options?.color,
      icon: options?.icon,
      buttons: options?.buttons,
    });

    await toast.present();
  }

  /**
   * Show a success toast (green)
   */
  async success(message: string, duration = 3000): Promise<void> {
    await this.show(message, {
      duration,
      color: 'success',
      icon: 'checkmark-circle-outline'
    });
  }

  /**
   * Show an error toast (red)
   */
  async error(message: string, duration = 4000): Promise<void> {
    await this.show(message, {
      duration,
      color: 'danger',
      icon: 'alert-circle-outline'
    });
  }

  /**
   * Show a warning toast (orange)
   */
  async warning(message: string, duration = 3500): Promise<void> {
    await this.show(message, {
      duration,
      color: 'warning',
      icon: 'warning-outline'
    });
  }

  /**
   * Show an info toast (blue)
   */
  async info(message: string, duration = 3000): Promise<void> {
    await this.show(message, {
      duration,
      color: 'primary',
      icon: 'information-circle-outline'
    });
  }
}
