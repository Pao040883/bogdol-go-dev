import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonIcon,
  IonSpinner,
  IonBadge,
  IonButtons,
  IonBackButton,
  IonTextarea,
  IonActionSheet,
  ActionSheetController,
  IonContent as IonContentComponent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  arrowBack,
  send,
  documentOutline,
  thumbsUpOutline,
  lockClosed, 
  calendar, 
  time, 
  documentText, 
  checkmarkCircle, 
  closeCircle, checkmarkDone } from 'ionicons/icons';

import {
  ChatConversation,
  ChatMessage,
  UserBasic,
  ChatMessagePayload,
  TypingIndicatorPayload
} from '../../models/intranet.models';
import { IntranetApiService } from '../../services/intranet-api.service';
import { IntranetWebSocketService } from '../../services/intranet-websocket.service';
import { AuthService } from '../../core/services/auth.service';
import { CryptoService } from '../../core/services/crypto.service';
import { BadgeService } from '../../services/badge.service';
import { EmojiPickerComponent } from '../../shared/components/emoji-picker/emoji-picker.component';
import { ModalController } from '@ionic/angular/standalone';
import { AbsenceApprovalFromChatModalComponent } from '../absence-approval-from-chat-modal/absence-approval-from-chat-modal.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButton,
    IonIcon,
    IonSpinner,
    IonBadge,
    IonButtons,
    IonBackButton,
    IonTextarea,
    EmojiPickerComponent
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer?: IonContentComponent;

  conversation: ChatConversation | null = null;
  messages: ChatMessage[] = [];
  newMessageContent = '';
  currentUser: UserBasic | null = null;

  isLoading = false;
  isConnected = false;
  typingUsers$ = new BehaviorSubject<Set<string>>(new Set());
  
  // E2E Encryption
  isE2EEnabled = false;
  recipientPublicKeys: Map<number, string> = new Map();
  
  private typingTimeout: any;
  private destroy$ = new Subject<void>();
  private shouldScroll = true;
  private conversationId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private apiService: IntranetApiService,
    private wsService: IntranetWebSocketService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private actionSheetController: ActionSheetController,
    private cryptoService: CryptoService,
    private modalCtrl: ModalController,
    private badgeService: BadgeService
  ) {
    this.conversationId = parseInt(route.snapshot.params['conversationId'] || '0', 10);
    
    addIcons({lockClosed,documentOutline,calendar,time,documentText,checkmarkCircle,checkmarkDone,closeCircle,send,arrowBack,thumbsUpOutline});
  }

  ngOnInit(): void {
    // Load current user from AuthService
    const user = this.authService.activeUser();
    if (user) {
      this.currentUser = {
        id: user.id,
        username: user.username,
        full_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
        online_status: 'online',
        is_active: true
      };
    }
    
    if (this.conversationId) {
      this.loadConversation();
      this.connectWebSocket();
      this.subscribeToWebSocketMessages();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      // Use setTimeout to ensure DOM is fully updated
      setTimeout(() => {
        this.scrollToBottom();
      }, 0);
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.wsService.disconnectFromChat();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================================================
  // LOAD DATA
  // ========================================================================

  private loadConversation(): void {
    this.isLoading = true;
    this.apiService.getConversation(this.conversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (conv) => {
          this.conversation = conv;
          await this.loadPublicKeys();
          this.loadMessages();
          // Markiere Conversation als gelesen
          this.markAsRead();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Fehler beim Laden der Konversation:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private markAsRead(): void {
    if (!this.conversationId) return;
    
    this.apiService.markConversationAsRead(this.conversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ mark_as_read Response:', response);
          // Badge-Counts direkt aus Response aktualisieren
          if (response.badges) {
            console.log('🔔 Aktualisiere Badges:', response.badges);
            Object.entries(response.badges).forEach(([key, value]) => {
              console.log(`  Setting badge ${key} = ${value}`);
              this.badgeService.setBadge(key as any, value as number);
            });
          }
        },
        error: (err) => {
          console.error('Fehler beim Markieren als gelesen:', err);
        }
      });
  }

  /**
   * Load public keys for all conversation participants
   */
  private async loadPublicKeys(): Promise<void> {
    if (!this.conversation || !this.currentUser) {
      console.log('⚠️ Cannot load keys: conversation or currentUser missing');
      return;
    }

    try {
      // Get all participant IDs except current user
      const participantIds = this.conversation.participants
        .filter(id => id !== this.currentUser!.id);

      if (participantIds.length === 0) {
        console.log('⚠️ No other participants in conversation');
        return;
      }

      // Fetch public keys from server
      const keys = await this.apiService.getPublicKeys(participantIds).toPromise();

      if (keys) {
        // Store public keys in map
        Object.values(keys).forEach(keyData => {
          if (keyData.public_key) {
            this.recipientPublicKeys.set(keyData.user_id, keyData.public_key);
          } else {
            console.log(`⚠️ User ${keyData.user_id} (${keyData.username}) has no public key`);
          }
        });

        // Check if E2E is enabled (all participants have keys)
        this.isE2EEnabled = participantIds.every(id => this.recipientPublicKeys.has(id));
        
        if (!this.isE2EEnabled) {
          const missingKeys = participantIds.filter(id => !this.recipientPublicKeys.has(id));
        }
      }
    } catch (error) {
      console.error('❌ Failed to load public keys:', error);
      this.isE2EEnabled = false;
    }
  }

  /**
   * Decrypt messages that are encrypted
   */
  private async decryptMessages(): Promise<void> {
    if (!this.currentUser) return;

    const keyPair = await this.cryptoService.retrieveKeyPair(this.currentUser.id);
    if (!keyPair) {
      console.warn('⚠️ No private key available for decryption');
      // Mark encrypted messages as undecryptable
      for (const message of this.messages) {
        if (message.is_encrypted && message.content) {
          message.content = '[🔒 Verschlüsselte Nachricht - Schlüssel nicht verfügbar]';
        }
      }
      return;
    }

    for (const message of this.messages) {
      if (message.is_encrypted && message.content) {
        try {
          const decrypted = await this.cryptoService.decryptMessage(
            message.content,
            keyPair.privateKey
          );
          message.content = decrypted;
        } catch (error) {
          // Decryption failed - likely encrypted with different key
          console.warn(`⚠️ Message ${message.id} encrypted with incompatible key`);
          message.content = '[🔒 Verschlüsselte Nachricht - mit anderem Schlüssel verschlüsselt]';
        }
      }
    }
  }

  private loadMessages(): void {
    if (!this.conversationId) return;

    this.apiService.getConversationMessages(this.conversationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (response) => {
          this.messages = response.results;
          // Sortiere chronologisch (älteste zuerst, neueste zuletzt)
          this.messages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
          await this.decryptMessages();
          this.isLoading = false;
          this.shouldScroll = true;
          this.cdr.markForCheck();
          
          // Mark all unread messages as read
          this.markMessagesAsRead();
        },
        error: (err) => {
          console.error('Fehler beim Laden der Nachrichten:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private markMessagesAsRead(): void {
    if (!this.conversationId || !this.currentUser) return;

    // Find all unread messages from others
    const unreadMessages = this.messages.filter(msg => 
      msg.sender_data?.username !== this.currentUser?.username &&
      (!msg.read_by || !msg.read_by.includes(this.currentUser?.id || 0))
    );

    // Mark each as read via API
    unreadMessages.forEach(msg => {
      this.apiService.markMessageAsRead(msg.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Update local message read status
            if (msg.read_by && this.currentUser?.id) {
              msg.read_by.push(this.currentUser.id);
            }
          },
          error: (err) => console.error('Error marking message as read:', err)
        });
    });
  }

  // ========================================================================
  // WEBSOCKET
  // ========================================================================

  private connectWebSocket(): void {
    const token = this.authService.accessToken() || '';
    this.wsService.connectToChat(this.conversationId, token);
  }

  private subscribeToWebSocketMessages(): void {
    // Neue Nachrichten
    this.wsService.getChatMessages$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (msg: ChatMessagePayload) => {
        
        // Prüfe ob Nachricht schon mit echter ID existiert
        const exists = this.messages.some(m => m.id === msg.message_id);
        if (exists) {
          return;
        }
        
        // Suche nach optimistischer Nachricht mit temporärer ID
        const optimisticIndex = this.messages.findIndex(m => 
          m.id >= Date.now() - 10000 && // Temporäre ID in den letzten 10 Sekunden
          m.sender === this.currentUser?.id &&
          Math.abs(new Date(m.sent_at).getTime() - new Date(msg.timestamp).getTime()) < 5000
        );
        
        let originalCleartext: string | undefined;
        if (optimisticIndex !== -1) {
          // Speichere Klartext der optimistischen Nachricht
          originalCleartext = this.messages[optimisticIndex].content;
        }
        
        let content = msg.content;
        const isEncrypted = (msg as any).is_encrypted || false;
        const isSentByMe = msg.sender === this.currentUser?.username;

        // Try to decrypt if message is encrypted
        if (isEncrypted && this.currentUser) {
          // First try: use saved cleartext from optimistic message
          if (isSentByMe && originalCleartext) {
            content = originalCleartext;
          } 
          // Second try: decrypt with own private key (works for new multi-key format)
          else {
            try {
              const keyPair = await this.cryptoService.retrieveKeyPair(this.currentUser.id);
              if (keyPair) {
                content = await this.cryptoService.decryptMessage(msg.content, keyPair.privateKey);
              } else {
                console.warn('⚠️ No private key for decryption');
                content = '[Verschlüsselt - Schlüssel nicht verfügbar]';
              }
            } catch (error) {
              console.warn('⚠️ Could not decrypt message');
              content = '[Entschlüsselung fehlgeschlagen]';
            }
          }
        }
        
        const newMessage: ChatMessage = {
          id: msg.message_id,
          conversation: this.conversationId,
          sender: 0,  // Wird vom Server gesetzt
          sender_data: isSentByMe && this.currentUser ? this.currentUser : {
            id: 0,
            username: msg.sender,
            full_name: msg.sender_name,
            online_status: 'online',
            is_active: true
          },
          message_type: msg.message_type as any,
          content: content,
          metadata: msg.metadata,  // Wichtig für absence_request und absence_decision
          is_encrypted: isEncrypted,
          sent_at: msg.timestamp,
          read_by: [],
          read_by_count: 0,
          is_edited: false,
          is_deleted: false
        };

        // Wenn wir eine optimistische Nachricht haben, ersetze sie
        if (optimisticIndex !== -1) {
          this.messages[optimisticIndex] = newMessage;
        } else {
          this.messages.push(newMessage);
          
          // AUTO-READ: Wenn Nachricht von anderem User kommt, markiere als gelesen
          if (!isSentByMe && msg.message_id) {
            this.wsService.markMessageAsRead(msg.message_id);
          }
        }
        
        // Sortiere nach Zeitstempel (älteste zuerst, neueste zuletzt)
        this.messages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
        this.shouldScroll = true;
        this.cdr.markForCheck();
      });

    // Message Updates (z.B. Status-Änderungen bei Abwesenheiten)
    this.wsService.getMessageUpdates$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((update: any) => {
        const messageIndex = this.messages.findIndex(m => m.id === update.message_id);
        if (messageIndex !== -1 && update.metadata) {
          // Update metadata der existierenden Nachricht
          this.messages[messageIndex].metadata = {
            ...this.messages[messageIndex].metadata,
            ...update.metadata
          };
          this.cdr.markForCheck();
        }
      });

    // Typing Indicator
    this.wsService.getTypingIndicators$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((typing: TypingIndicatorPayload) => {
        // NUR ANDERE User anzeigen, nicht sich selbst!
        if (typing.username === this.currentUser?.username) {
          return;
        }
        
        const typingSet = this.typingUsers$.value;
        if (typing.is_typing) {
          typingSet.add(typing.username);
        } else {
          typingSet.delete(typing.username);
        }
        this.typingUsers$.next(new Set(typingSet));
        this.cdr.markForCheck();
      });

    // Reactions
    this.wsService.getMessageReactions$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((reaction) => {
        const message = this.messages.find(m => m.id === reaction.message_id);
        if (message) {
          if (!message.reactions) {
            message.reactions = {};
          }
          if (!message.reactions[reaction.emoji]) {
            message.reactions[reaction.emoji] = [];
          }
          if (!message.reactions[reaction.emoji].includes(reaction.username)) {
            message.reactions[reaction.emoji].push(reaction.username);
          }
          this.cdr.markForCheck();
        }
      });

    // Connection Status
    this.wsService.isChatConnected$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
        this.cdr.markForCheck();
      });
  }

  // ========================================================================
  // SEND MESSAGE
  // ========================================================================

  async sendMessage(): Promise<void> {
    if (!this.newMessageContent.trim() || !this.isConnected) {
      return;
    }

    const originalContent = this.newMessageContent.trim();
    let contentToSend = originalContent;
    let isEncrypted = false;

    try {
      // Attempt E2E encryption if enabled
      if (this.isE2EEnabled && this.recipientPublicKeys.size > 0 && this.currentUser) {
        // Get own keypair to encrypt for ourselves too
        const ownKeyPair = await this.cryptoService.retrieveKeyPair(this.currentUser.id);
        
        if (ownKeyPair) {
          // Collect all public keys: recipients + own
          const publicKeys: CryptoKey[] = [];
          
          // Add own public key
          publicKeys.push(ownKeyPair.publicKey);
          
          // Add recipient public keys
          for (const publicKeyStr of this.recipientPublicKeys.values()) {
            const recipientPublicKey = await this.cryptoService.importPublicKey(publicKeyStr);
            publicKeys.push(recipientPublicKey);
          }
          
          // Encrypt for all (including ourselves)
          contentToSend = await this.cryptoService.encryptMessageForMultiple(originalContent, publicKeys);
          isEncrypted = true;
        }
      }
    } catch (error) {
      console.error('❌ Encryption failed, sending unencrypted:', error);
      // Fallback to unencrypted
      contentToSend = originalContent;
      isEncrypted = false;
    }
    
    // Optimistisch: Nachricht sofort zur Liste hinzufügen (mit original content für Anzeige)
    if (this.currentUser) {
      const tempId = Date.now(); // Temporäre ID für spätere Erkennung
      const optimisticMessage: ChatMessage = {
        id: tempId,
        conversation: this.conversationId,
        sender: this.currentUser.id,
        sender_data: this.currentUser,
        message_type: 'text',
        content: originalContent, // Show unencrypted in UI
        is_encrypted: isEncrypted,
        sent_at: new Date().toISOString(),
        read_by: [this.currentUser.id],
        read_by_count: 1,
        is_edited: false,
        is_deleted: false
      };
      
      this.messages.push(optimisticMessage);
      this.shouldScroll = true;
      this.cdr.markForCheck();
      
      // Force scroll after a short delay to ensure DOM is updated
      setTimeout(() => {
        this.scrollToBottom();
      }, 50);
    }
    
    // Send encrypted content via WebSocket
    this.wsService.sendMessage(contentToSend, isEncrypted);
    this.newMessageContent = '';
    this.stopTyping();
  }

  // ========================================================================
  // TYPING
  // ========================================================================

  onInputChange(): void {
    this.wsService.sendTypingIndicator(true);

    // Stoppe typing nach 3 Sekunden Inaktivität
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 3000);
  }

  private stopTyping(): void {
    this.wsService.sendTypingIndicator(false);
    clearTimeout(this.typingTimeout);
  }

  // ========================================================================
  // INTERACTIONS
  // ========================================================================

  onMessageRightClick(message: ChatMessage): void {
    // Zeige Kontextmenü für Bearbeitung/Löschen
    // Implementation würde Modal/Popover öffnen
  }

  markMessageAsRead(message: ChatMessage): void {
    if (!message.read_by.includes(this.currentUser?.id || 0)) {
      this.wsService.markMessageAsRead(message.id);
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.scrollToBottom(300);
      }
    } catch (err) {
      // Scroll error - safe to ignore
    }
  }

  getTypingText(): string {
    const users = Array.from(this.typingUsers$.value);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} schreibt...`;
    return `${users.slice(0, -1).join(', ')} und ${users[users.length - 1]} schreiben...`;
  }

  getConversationTitle(): string {
    if (!this.conversation) return 'Chat';
    if (this.conversation.name) return this.conversation.name;
    
    // For direct messages, show other participant's name
    if (this.conversation.participants_data && this.conversation.participants_data.length > 0) {
      const otherUser = this.conversation.participants_data.find(p => p.username !== this.currentUser?.username);
      return otherUser ? otherUser.full_name : 'Direct Message';
    }
    
    return 'Chat';
  }

  getInitials(fullName: string): string {
    if (!fullName) return '?';
    const names = fullName.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  /**
   * Called when user long-presses a message
   */
  async onMessageLongPress(message: ChatMessage): Promise<void> {
    // Nur eigene Nachrichten können gelöscht werden
    if (message.sender_data?.username !== this.currentUser?.username) {
      return;
    }

    // Bereits gelöschte Nachrichten nicht nochmal löschen
    if (message.is_deleted) {
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Nachricht',
      buttons: [
        {
          text: 'Löschen',
          role: 'destructive',
          icon: 'trash',
          handler: () => {
            this.deleteMessage(message);
          }
        },
        {
          text: 'Abbrechen',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });

    await actionSheet.present();
  }

  /**
   * Delete a message via API
   */
  private deleteMessage(message: ChatMessage): void {
    this.apiService.deleteMessage(message.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Soft delete: Markiere Nachricht als gelöscht (zeige "gelöscht" Platzhalter)
          message.is_deleted = true;
          message.content = '';
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting message:', err);
          // TODO: Show error toast
        }
      });
  }

  /**
   * Insert emoji at cursor position in message input
   */
  onEmojiSelected(emoji: string): void {
    this.newMessageContent += emoji;
  }

  /**
   * Add reaction to message
   */
  addReaction(message: ChatMessage, emoji: string): void {
    this.apiService.addMessageReaction(message.id, emoji)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update local message reactions
          if (!message.reactions) {
            message.reactions = {};
          }
          if (!message.reactions[emoji]) {
            message.reactions[emoji] = [];
          }
          if (this.currentUser?.username && !message.reactions[emoji].includes(this.currentUser.username)) {
            message.reactions[emoji].push(this.currentUser.username);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error adding reaction:', err);
          console.error('Message ID:', message.id);
          console.error('Emoji:', emoji);
          console.error('Full error:', JSON.stringify(err));
        }
      });
  }

  /**
   * Remove reaction from message
   */
  removeReaction(message: ChatMessage, emoji: string): void {
    this.apiService.removeMessageReaction(message.id, emoji)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Update local message reactions
          if (message.reactions && message.reactions[emoji] && this.currentUser?.username) {
            const index = message.reactions[emoji].indexOf(this.currentUser.username);
            if (index > -1) {
              message.reactions[emoji].splice(index, 1);
            }
            if (message.reactions[emoji].length === 0) {
              delete message.reactions[emoji];
            }
          }
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error removing reaction:', err)
      });
  }

  /**
   * Toggle reaction (add if not present, remove if present)
   */
  toggleReaction(message: ChatMessage, emoji: string): void {
    const hasReacted = message.reactions?.[emoji]?.includes(this.currentUser?.username || '');
    if (hasReacted) {
      this.removeReaction(message, emoji);
    } else {
      this.addReaction(message, emoji);
    }
  }

  /**
   * Check if current user has reacted with emoji
   */
  hasUserReacted(message: ChatMessage, emoji: string): boolean {
    return message.reactions?.[emoji]?.includes(this.currentUser?.username || '') || false;
  }

  // ========================================================================
  // ABSENCE MESSAGE HANDLING
  // ========================================================================

  /**
   * Format absence date for display
   */
  formatAbsenceDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Get absence status label
   */
  getAbsenceStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': 'Ausstehend',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'cancelled': 'Storniert',
      'revision_requested': 'Überarbeitung erforderlich',
      'hr_processed': 'HR bearbeitet'
    };
    return labels[status] || status;
  }

  /**
   * Check if current user can approve the absence request
   */
  canApproveAbsence(message: ChatMessage): boolean {
    // Can approve if:
    // 1. Message is absence_request type
    // 2. Status is pending or revision_requested
    // 3. Current user is NOT the sender (can't approve own request)
    if (message.message_type !== 'absence_request') return false;
    if (!message.metadata) return false;
    if (message.sender === this.currentUser?.id) return false;
    
    const status = message.metadata['status'];
    return status === 'pending' || status === 'revision_requested';
  }

  /**
   * Open absence approval modal
   */
  async openAbsenceApprovalModal(message: ChatMessage): Promise<void> {
    if (!message.metadata || !message.metadata['absence_id']) {
      console.error('No absence_id in message metadata');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: AbsenceApprovalFromChatModalComponent,
      componentProps: {
        absenceId: message.metadata['absence_id'],
        metadata: message.metadata
      },
      cssClass: 'absence-approval-modal'
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    
    if (role === 'approved' || role === 'rejected') {
      // Reload messages to get updated status
      this.loadMessages();
    }
  }
}

