import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ViewWillEnter, AlertController } from '@ionic/angular';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonBadge,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonInput,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonAccordionGroup,
  IonAccordion
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  peopleOutline, 
  chatbubblesOutline, 
  radioOutline, 
  timeOutline, 
  stopCircleOutline, 
  ellipseOutline,
  chatbubbleOutline,
  trash
} from 'ionicons/icons';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { IntranetApiService } from '../../../services/intranet-api.service';
import { IntranetWebSocketService } from '../../../services/intranet-websocket.service';
import { ChatConversation, UserPresence } from '../../../models/intranet.models';
import { JwtUtilsService } from '../../../core/services/jwt-utils.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { CryptoService } from '../../../core/services/crypto.service';
import { BadgeService } from '../../../services/badge.service';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonBadge,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonInput,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonAccordionGroup,
    IonAccordion
  ],
  templateUrl: './chat-list.page.html',
  styleUrls: ['./chat-list.page.scss'],
})
export class ChatListPage implements OnInit, OnDestroy, ViewWillEnter {
  constructor(private alertController: AlertController) {
    addIcons({peopleOutline, chatbubbleOutline, chatbubblesOutline, trash, radioOutline, timeOutline, stopCircleOutline, ellipseOutline});
  }

  private apiService = inject(IntranetApiService);
  private wsService = inject(IntranetWebSocketService);
  private router = inject(Router);
  private jwtUtils = inject(JwtUtilsService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private cryptoService = inject(CryptoService);
  private badgeService = inject(BadgeService);
  private destroy$ = new Subject<void>();

  conversations: ChatConversation[] = [];
  allUsers: UserPresence[] = [];
  onlineUsers: UserPresence[] = [];
  offlineUsers: UserPresence[] = [];
  isLoading = false;
  currentStatus: 'online' | 'away' | 'busy' | 'offline' = 'online';
  statusMessage = '';
  currentUsername = '';
  currentUserId = 0;

  ngOnInit() {
    // Get current user from AuthService activeUser signal
    const user = this.authService.activeUser();
    this.currentUsername = user?.username || '';
    this.currentUserId = user?.id || 0;
    
    this.loadConversations();
    
    // WICHTIG: Erst User laden, DANN WebSocket verbinden
    // Grund: WebSocket sendet sofort Online-Liste, aber wenn allUsers leer ist, verpufft das Update
    this.loadAllUsers();
    // connectPresence wird NACH loadAllUsers aufgerufen (siehe loadAllUsers)
    
    this.subscribeToNewMessages();
  }

  ionViewWillEnter() {
    // Reload conversations when returning to this page (updates badges)
    this.loadConversations();
  }

  ngOnDestroy() {
    this.wsService.disconnectFromPresence();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadConversations() {
    this.isLoading = true;
    this.apiService.getConversations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (response) => {
          // Sort by last_message_at (newest first)
          this.conversations = response.results.sort((a, b) => {
            const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return dateB - dateA; // Descending (newest first)
          });
          
          // Decrypt encrypted message previews
          await this.decryptConversationPreviews();
          
          // Update badge count
          this.updateChatBadge();
          
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading conversations:', err);
          this.isLoading = false;
        }
      });
  }

  private loadAllUsers() {
    // Load all users from profiles API
    this.apiService.searchProfiles({})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Convert profiles to UserPresence format
          this.allUsers = response.results.map(profile => ({
            username: profile.username,
            full_name: `${profile.first_name} ${profile.last_name}`.trim() || profile.username,
            status: 'offline' as const, // Default to offline, will be updated by presence
            status_message: '',
            is_available_for_chat: true,
            last_seen: new Date().toISOString()
          }));
          this.updateUserLists();
          
          // JETZT erst WebSocket verbinden, wenn User-Liste fertig ist
          this.connectPresence();
        },
        error: (err) => console.error('Error loading users:', err)
      });
  }

  private loadPresence() {
    this.apiService.getPresence()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Update status of users who are online
          response.results.forEach(onlineUser => {
            const user = this.allUsers.find(u => u.username === onlineUser.username);
            if (user) {
              user.status = onlineUser.status;
              user.status_message = onlineUser.status_message;
              user.is_available_for_chat = onlineUser.is_available_for_chat;
              user.last_seen = onlineUser.last_seen;
            }
          });
          this.updateUserLists();
        },
        error: (err) => console.error('Error loading presence:', err)
      });
  }

  private updateUserLists() {
    // Separate online and offline users
    const online = this.allUsers.filter(u => u.status !== 'offline' && u.username !== this.currentUsername);
    const offline = this.allUsers.filter(u => u.status === 'offline' && u.username !== this.currentUsername);
    
    // Sort alphabetically by full_name
    this.onlineUsers = online.sort((a, b) => a.full_name.localeCompare(b.full_name));
    this.offlineUsers = offline.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  private connectPresence() {
    const token = this.authService.accessToken() || '';
    this.wsService.connectToPresence(token);

    // Initiale Online-User-Liste beim Connect
    this.wsService.getOnlineUsers$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((usernames) => {
        
        // Synchronisiere Status mit WebSocket-Liste
        const onlineSet = new Set(usernames);
        
        this.allUsers.forEach(user => {
          if (onlineSet.has(user.username)) {
            // User ist online
            user.status = 'online';
          } else {
            // User ist NICHT in der Online-Liste -> offline setzen
            user.status = 'offline';
          }
        });
        
        // Update Online-Status in Konversations-Participants
        this.conversations.forEach(conv => {
          if (conv.participants_data) {
            conv.participants_data.forEach(participant => {
              if (onlineSet.has(participant.username)) {
                participant.online_status = 'online';
              } else {
                participant.online_status = 'offline';
              }
            });
          }
        });
        
        this.updateUserLists();
      });

    // Status-Änderungen in Realtime
    this.wsService.getStatusChanges$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        const user = this.allUsers.find(u => u.username === update.username);
        
        if (user) {
          // Update existing user
          user.status = update.status;
          user.full_name = update.full_name;
          user.status_message = update.status_message;
          user.is_available_for_chat = true;
          user.last_seen = new Date().toISOString();
        } else {
          // Add new user (if not in list yet)
          this.allUsers.push({
            username: update.username,
            full_name: update.full_name,
            status: update.status,
            status_message: update.status_message,
            is_available_for_chat: true,
            last_seen: new Date().toISOString()
          });
        }
        
        // Update Online-Status in Konversations-Participants
        this.conversations.forEach(conv => {
          if (conv.participants_data) {
            const participant = conv.participants_data.find(p => p.username === update.username);
            if (participant) {
              participant.online_status = update.status;
            }
          }
        });
        
        this.updateUserLists();
      });
    
    // Verbinde zu Notifications WebSocket
    this.wsService.connectToNotifications(token);
  }

  private subscribeToNewMessages() {
    // Aktualisiere Preview wenn neue Nachricht als Benachrichtigung kommt
    this.wsService.getNewMessageNotifications$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        
        // Finde die betroffene Conversation
        const conv = this.conversations.find(c => c.id === msg.conversation_id);
        
        if (conv) {
          // Aktualisiere Preview und Timestamp
          // Backend sendet 'preview' field, nicht 'content'
          const preview = (msg as any).preview || msg.content?.substring(0, 50) || '';
          conv.last_message_preview = {
            sender: msg.sender_name,
            content: preview,
            sent_at: msg.timestamp
          };
          conv.last_message_at = msg.timestamp;
          
          // Erhöhe unread_count wenn Nachricht nicht von mir
          if (msg.sender !== this.currentUsername) {
            conv.unread_count = (conv.unread_count || 0) + 1;
          }
          
          // Update badge count
          this.updateChatBadge();
          
          // Sortiere Liste neu (neueste zuerst)
          this.conversations.sort((a, b) => {
            const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return dateB - dateA;
          });
        } else {
          // Neue Conversation - Lade komplette Liste neu
          this.loadConversations();
        }
      });
  }

  openConversation(conversationId: number) {
    this.router.navigate(['/chat', conversationId]);
  }

  startChatWithUser(username: string) {
    // Check if conversation already exists with this user
    const existingConv = this.conversations.find(conv => {
      // For direct messages, check if user is in participants (not me)
      if (conv.conversation_type !== 'direct') return false;
      
      // Find the other participant (not current user)
      const otherParticipant = conv.participants_data?.find(p => p.username !== this.currentUsername);
      return otherParticipant?.username === username;
    });

    if (existingConv) {
      // Navigate to existing conversation
      this.openConversation(existingConv.id);
    } else {
      // Need to get user ID - use API to search
      this.apiService.searchProfiles({ q: username })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            const foundUser = response.results.find(u => u.username === username);
            if (foundUser) {
              this.createNewConversation(foundUser.id);
            } else {
              this.toastService.error('Benutzer nicht gefunden');
            }
          },
          error: (err) => {
            console.error('Error finding user:', err);
            this.toastService.error('Benutzer konnte nicht gefunden werden');
          }
        });
    }
  }

  private createNewConversation(userId: number) {
    this.apiService.createConversation({
      conversation_type: 'direct',
      participants: [userId]
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (newConv) => {
          this.toastService.success('Chat erstellt');
          this.openConversation(newConv.id);
        },
        error: (err) => {
          console.error('Error creating conversation:', err);
          this.toastService.error('Chat konnte nicht erstellt werden');
        }
      });
  }

  updateStatus() {
    this.wsService.updateUserStatus(this.currentStatus, this.statusMessage);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'online': return 'radio-outline';
      case 'away': return 'time-outline';
      case 'busy': return 'stop-circle-outline';
      default: return 'ellipse-outline';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'online': return 'success';
      case 'away': return 'warning';
      case 'busy': return 'danger';
      default: return 'medium';
    }
  }

  getConversationTitle(conv: ChatConversation): string {
    if (conv.name) {
      return conv.name;
    }
    
    // For direct messages, show the OTHER participant's name
    if (conv.participants_data && conv.participants_data.length > 0) {
      const otherUser = conv.participants_data.find(p => p.username !== this.currentUsername);
      
      if (otherUser) {
        return otherUser.full_name || otherUser.username;
      }
    }
    
    return 'Direct Message';
  }

  getLastMessageText(conv: ChatConversation): string {
    if (!conv.last_message_preview) {
      return 'Keine Nachrichten';
    }
    
    const preview = conv.last_message_preview;
    const sender = preview.sender || 'Unbekannt';
    const content = preview.content || '[Datei]';
    
    return `${sender}: ${content}`;
  }

  isUserOnline(conv: ChatConversation): boolean {
    if (!conv.participants_data || conv.participants_data.length === 0) {
      return false;
    }
    
    // Finde den anderen User (nicht ich selbst)
    const otherUser = conv.participants_data.find(p => p.username !== this.currentUsername);
    return otherUser?.online_status === 'online';
  }

  hasInactiveParticipant(conv: ChatConversation): boolean {
    if (!conv.participants_data || conv.participants_data.length === 0) {
      return false;
    }
    
    // Check if any participant (excluding current user) is inactive
    return conv.participants_data.some(p => 
      p.username !== this.currentUsername && !p.is_active
    );
  }

  private async decryptConversationPreviews(): Promise<void> {
    if (!this.currentUserId) {
      return;
    }

    // Retry mechanism: Try up to 3 times to get keys (handles race condition on initial load)
    let keyPair = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      keyPair = await this.cryptoService.retrieveKeyPair(this.currentUserId);
      if (keyPair) break;
      
      // Wait before retry (50ms, 100ms, 200ms)
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
      }
    }

    if (!keyPair) {
      console.warn('⚠️ No encryption keys available - skipping preview decryption');
      return;
    }


    for (const conv of this.conversations) {
      if (conv.last_message_preview?.content) {
        const preview = conv.last_message_preview;
        
        
        // Check if content looks like encrypted data (starts with {)
        if (preview.content.startsWith('{')) {
          try {
            // Parse to see the structure
            const parsed = JSON.parse(preview.content);
           
            const decrypted = await this.cryptoService.decryptMessage(
              preview.content,
              keyPair.privateKey
            );
            preview.content = decrypted;
          } catch (err: any) {
            console.warn('⚠️ Entschlüsselung fehlgeschlagen für Konversation', conv.id, ':', err.message);
            // Show placeholder for encrypted messages that can't be decrypted
            preview.content = '🔒 Verschlüsselte Nachricht';
          }
        }
      }
    }
  }

  async deleteConversation(conv: ChatConversation, slidingItem: any) {
    const alert = await this.alertController.create({
      header: 'Chat löschen',
      message: `Chat mit "${this.getConversationTitle(conv)}" wirklich löschen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel',
          handler: () => {
            slidingItem.close();
          }
        },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            this.apiService.hideConversation(conv.id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.conversations = this.conversations.filter(c => c.id !== conv.id);
                  this.updateChatBadge();
                  slidingItem.close();
                },
                error: async (err) => {
                  console.error('Fehler beim Löschen:', err);
                  const errorAlert = await this.alertController.create({
                    header: 'Fehler',
                    message: 'Chat konnte nicht gelöscht werden',
                    buttons: ['OK']
                  });
                  await errorAlert.present();
                  slidingItem.close();
                }
              });
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Aktualisiert den Chat-Badge-Count im BadgeService
   * Summiert alle ungelesenen Nachrichten aller Konversationen
   */
  private updateChatBadge() {
    const totalUnread = this.conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
    this.badgeService.setBadge('chat', totalUnread);
  }
}
