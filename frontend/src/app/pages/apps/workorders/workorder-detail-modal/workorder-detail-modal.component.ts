import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonItem, IonLabel,
  IonButtons, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonTextarea, IonPopover, IonSpinner, IonFooter, IonChip, AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, checkmarkCircle, documentText, person, calendar, chatbubbles, send, closeCircle, lockClosed, eye } from 'ionicons/icons';
import { WorkOrder } from 'src/app/core/interfaces/workorder.types';
import { WorkOrderService } from 'src/app/core/services/workorder.service';
import { IntranetApiService } from 'src/app/services/intranet-api.service';
import { CryptoService } from 'src/app/core/services/crypto.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { OrganizationService } from 'src/app/core/services/organization.service';

@Component({
  selector: 'app-workorder-detail-modal',
  templateUrl: './workorder-detail-modal.component.html',
  styleUrls: ['./workorder-detail-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonItem, IonLabel,
    IonButtons, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonTextarea, IonPopover, IonSpinner, IonFooter, IonChip,
    NgxExtendedPdfViewerModule
  ],
})
export class WorkOrderDetailModalComponent implements OnInit {
  @Input() workOrder: WorkOrder | null = null;
  @Input() isOpen = false;
  @Output() didDismiss = new EventEmitter<void>();
  @Output() workOrderUpdated = new EventEmitter<void>();
  @Output() navigateToChat = new EventEmitter<number>();

  private readonly workOrderService = inject(WorkOrderService);
  private readonly intranetApi = inject(IntranetApiService);
  private readonly cryptoService = inject(CryptoService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly organizationService = inject(OrganizationService);

  isLoading = signal(false);
  isChatModalOpen = signal(false);
  chatMessage = signal('');
  pdfUrl = signal<string>('');
  canEdit = signal(false);
  canView = signal(true);
  isCheckingPermissions = signal(false);

  constructor() {
    addIcons({close,lockClosed,eye,closeCircle,chatbubbles,checkmarkCircle,send,documentText,person,calendar});
  }

  ngOnInit() {
    this.loadPdfUrl();
    this.checkPermissions();
  }

  private checkPermissions() {
    if (!this.workOrder?.id) return;

    this.isCheckingPermissions.set(true);

    // Check if user can process this workorder
    this.organizationService.canProcessWorkorder(this.workOrder.id).subscribe({
      next: (canProcess) => {
        this.canEdit.set(canProcess);
        this.isCheckingPermissions.set(false);
      },
      error: (error) => {
        console.error('Error checking workorder permissions:', error);
        this.canEdit.set(false);
        this.isCheckingPermissions.set(false);
      }
    });

    // Check if user can view
    this.organizationService.canViewWorkorder(this.workOrder.id).subscribe({
      next: (canView) => {
        this.canView.set(canView);
      },
      error: (error) => {
        console.error('Error checking view permissions:', error);
        this.canView.set(false);
      }
    });
  }

  private loadPdfUrl() {
    if (!this.workOrder?.scanned_document) return;

    const url = this.workOrder.scanned_document.startsWith('http')
      ? this.workOrder.scanned_document
      : `${environment.apiUrl}${this.workOrder.scanned_document}`;

    this.pdfUrl.set(url);
  }

  downloadPdf() {
    if (!this.pdfUrl()) return;

    const link = document.createElement('a');
    link.href = this.pdfUrl();
    link.download = `Arbeitsschein_${this.workOrder?.order_number || 'download'}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  openChatModal() {
    this.isChatModalOpen.set(true);
    this.chatMessage.set('');
  }

  closeChatModal() {
    this.isChatModalOpen.set(false);
    this.chatMessage.set('');
  }

  async sendChatMessage() {
    const messageContent = this.chatMessage().trim();
    
    if (!messageContent) {
      console.error('❌ Missing content');
      return;
    }

    // Bestimme Empfänger basierend auf aktueller User-Rolle
    const currentUser = this.authService.activeUser();
    let recipientId: number | null = null;
    
    if (!currentUser || !this.workOrder) {
      console.error('❌ Missing current user or workorder');
      return;
    }
    
    // Wenn ich der Ersteller bin → Nachricht an Faktur-MA
    // Wenn ich der Faktur-MA bin → Nachricht an Ersteller
    if (this.workOrder.created_by === currentUser.id) {
      // Ich bin der Ersteller → sende an Faktur-MA
      recipientId = this.workOrder.responsible_billing_user?.id || null;
    } else if (this.workOrder.responsible_billing_user?.id === currentUser.id) {
      // Ich bin der Faktur-MA → sende an Ersteller
      recipientId = this.workOrder.created_by || null;
    } else {
      // Fallback: Sende an Ersteller
      recipientId = this.workOrder.created_by || null;
    }
    
    if (!recipientId) {
      console.error('❌ Kein Empfänger gefunden');
      await this.showToast('Fehler: Kein Empfänger für die Nachricht gefunden', 'danger');
      return;
    }

    this.isLoading.set(true);
    try {
      // Check if a direct conversation already exists with this user
      let conversation = await this.intranetApi.findConversationWithUser(recipientId).toPromise();
      
      // If no conversation exists, create one
      if (!conversation) {
        conversation = await this.intranetApi.createConversation({
          participants: [recipientId],
          conversation_type: 'direct',
          name: ''  // Empty name for direct chats - shows user name instead
        }).toPromise();

        if (!conversation) {
          throw new Error('Konversation konnte nicht erstellt werden');
        }
      } 

      // Prepare file attachment
      let fileToAttach: File | null = null;
      
      if (this.workOrder.scanned_document) {
        try {
          const pdfUrl = this.workOrder.scanned_document.startsWith('http') 
            ? this.workOrder.scanned_document 
            : `${environment.apiUrl}${this.workOrder.scanned_document}`;
          
          const response = await fetch(pdfUrl);
          
          if (!response.ok) {
            throw new Error(`PDF fetch failed: ${response.status}`);
          }
          
          const blob = await response.blob();
          const filename = this.workOrder.scanned_document.split('/').pop() || 'arbeitsschein.pdf';
          fileToAttach = new File([blob], filename, { type: 'application/pdf' });
        } catch (attachError) {
          console.error('❌ Error preparing PDF:', attachError);
        }
      }

      // E2E Encryption
      let contentToSend = messageContent;
      let isEncrypted = false;
      
      try {
        
        // Get recipient's public key (recipientId wurde oben bereits bestimmt)
        const publicKeysResponse = await this.intranetApi.getPublicKeys([recipientId]).toPromise();
          
        if (publicKeysResponse && Object.keys(publicKeysResponse).length > 0) {
          const publicKeys: CryptoKey[] = [];
          const currentUser = this.authService.activeUser();
          
          if (!currentUser) {
            console.error('❌ No current user for encryption');
          } else {
            // Add recipient's public key
            const recipientKey = Object.values(publicKeysResponse)[0];
            if (recipientKey?.public_key) {
              const recipientCryptoKey = await this.cryptoService.importPublicKey(recipientKey.public_key);
              publicKeys.push(recipientCryptoKey);
            }
            
            // Add own public key (so we can read our own messages)
            const ownKeyPair = await this.cryptoService.retrieveKeyPair(currentUser.id);
            if (ownKeyPair?.publicKey) {
              publicKeys.push(ownKeyPair.publicKey);
            }
            
            if (publicKeys.length >= 2) {
              // Encrypt for both users
              contentToSend = await this.cryptoService.encryptMessageForMultiple(messageContent, publicKeys);
              isEncrypted = true;
            } 
          }
        }
      } catch (encryptError) {
        console.error('❌ Encryption failed, sending unencrypted:', encryptError);
      }
      
      if (fileToAttach) {
        const result = await this.intranetApi.sendMessageWithFile(
          conversation.id, 
          contentToSend, 
          fileToAttach,
          isEncrypted
        ).toPromise();
      } else {
        const result = await this.intranetApi.sendMessage(conversation.id, {
          content: contentToSend,
          message_type: 'text',
          is_encrypted: isEncrypted
        }).toPromise();
      }
      
      await this.showToast('Nachricht gesendet', 'success');
      
      // Just close the chat modal - stay in detail modal
      this.closeChatModal();
      
    } catch (error) {
      console.error('❌ Error sending chat message:', error);
      await this.showToast('Fehler beim Senden', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async markAsBilled() {
    if (!this.workOrder?.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Abrechnung bestätigen',
      message: `Arbeitsschein ${this.workOrder.order_number} als abgerechnet markieren?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Bestätigen',
          handler: async () => {
            this.isLoading.set(true);
            try {
              await this.workOrderService.markAsBilled(this.workOrder!.id!).toPromise();
              await this.showToast('Als abgerechnet markiert', 'success');
              this.workOrderUpdated.emit();
              this.close();
            } catch (error) {
              console.error('Error marking as billed:', error);
              await this.showToast('Fehler beim Abrechnen', 'danger');
            } finally {
              this.isLoading.set(false);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async cancelWorkOrder() {
    if (!this.workOrder?.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Stornierung bestätigen',
      message: `Möchten Sie den Arbeitsschein ${this.workOrder.order_number} wirklich stornieren?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Stornieren',
          role: 'destructive',
          handler: async () => {
            this.isLoading.set(true);
            try {
              await this.workOrderService.cancelWorkOrder(this.workOrder!.id!).toPromise();
              await this.showToast('Arbeitsschein storniert', 'success');
              this.workOrderUpdated.emit();
              this.close();
            } catch (error: any) {
              console.error('Error cancelling work order:', error);
              const errorMsg = error?.error?.error || 'Fehler beim Stornieren';
              await this.showToast(errorMsg, 'danger');
            } finally {
              this.isLoading.set(false);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  close() {
    this.closeChatModal();
    this.didDismiss.emit();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return 'Nicht angegeben';
    return new Date(date).toLocaleDateString('de-DE');
  }
}
