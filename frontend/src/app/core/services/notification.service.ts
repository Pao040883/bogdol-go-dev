import { Injectable, signal, inject, computed } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular/standalone';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
  read?: boolean;
  actionable?: boolean;
  action?: () => void;
  actionLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  private notifications = signal<AppNotification[]>([]);
  private _unreadCount = computed(() => 
    this.notifications().filter(n => !n.read).length
  );

  readonly notifications$ = this.notifications.asReadonly();
  readonly unreadCount$ = this._unreadCount;

  /**
   * Zeigt Toast-Benachrichtigung
   */
  async showToast(
    message: string, 
    type: AppNotification['type'] = 'info',
    duration: number = 3000
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'top',
      color: this.getIonicColor(type),
      buttons: [{
        text: 'OK',
        role: 'cancel'
      }]
    });

    await toast.present();
  }

  /**
   * Fügt dauerhafte Benachrichtigung hinzu
   */
  addNotification(notification: Omit<AppNotification, 'id' | 'timestamp'>): void {
    const newNotification: AppNotification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.notifications.update(notifications => [newNotification, ...notifications]);
  }

  /**
   * Markiert Benachrichtigung als gelesen
   */
  markAsRead(id: string): void {
    this.notifications.update(notifications =>
      notifications.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  /**
   * Markiert alle als gelesen
   */
  markAllAsRead(): void {
    this.notifications.update(notifications =>
      notifications.map(n => ({ ...n, read: true }))
    );
  }

  /**
   * Entfernt Benachrichtigung
   */
  removeNotification(id: string): void {
    this.notifications.update(notifications =>
      notifications.filter(n => n.id !== id)
    );
  }

  /**
   * Zeigt Alert-Dialog
   */
  async showAlert(
    title: string,
    message: string,
    buttons: string[] = ['OK']
  ): Promise<string> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: title,
        message,
        buttons: buttons.map(text => ({
          text,
          handler: () => resolve(text)
        }))
      });

      await alert.present();
    });
  }

  /**
   * Zeigt Bestätigungs-Dialog
   */
  async showConfirmation(
    title: string,
    message: string,
    confirmText: string = 'Bestätigen',
    cancelText: string = 'Abbrechen'
  ): Promise<boolean> {
    const result = await this.showAlert(title, message, [cancelText, confirmText]);
    return result === confirmText;
  }

  private getIonicColor(type: AppNotification['type']): string {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'info': return 'primary';
      default: return 'medium';
    }
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Quick Actions für häufige Benachrichtigungen
   */
  notifySuccess(message: string): void {
    this.showToast(message, 'success');
    this.addNotification({
      title: 'Erfolg',
      message,
      type: 'success'
    });
  }

  notifyError(message: string): void {
    this.showToast(message, 'error', 5000);
    this.addNotification({
      title: 'Fehler',
      message,
      type: 'error'
    });
  }

  notifyWarning(message: string): void {
    this.showToast(message, 'warning', 4000);
    this.addNotification({
      title: 'Warnung',
      message,
      type: 'warning'
    });
  }
}
