/**
 * WebSocket Service für RealTime Chat & Presence
 */
import { Injectable, NgZone, inject } from '@angular/core';
import { Subject, BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import {
  ChatMessage,
  UserPresence,
  WebSocketMessage,
  ChatMessagePayload,
  StatusChangedPayload,
  TypingIndicatorPayload,
  ReactionPayload
} from '../models/intranet.models';

interface WebSocketConfig {
  wsUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

@Injectable({
  providedIn: 'root'
})
export class IntranetWebSocketService {
  private chatSocket: WebSocket | null = null;
  private presenceSocket: WebSocket | null = null;
  private notificationsSocket: WebSocket | null = null;

  // Chat Subjects
  private chatMessages$ = new ReplaySubject<ChatMessagePayload>(50);
  private messageUpdates$ = new Subject<any>();
  private typingIndicators$ = new Subject<TypingIndicatorPayload>();
  private messageReactions$ = new Subject<ReactionPayload>();
  private userJoined$ = new Subject<any>();
  private userLeft$ = new Subject<any>();

  // Presence Subjects
  private statusChanges$ = new Subject<StatusChangedPayload>();
  private onlineUsers$ = new BehaviorSubject<string[]>([]);
  
  // Notifications Subject
  private newMessageNotifications$ = new Subject<ChatMessagePayload>();

  // Connection Status
  private chatConnected$ = new BehaviorSubject<boolean>(false);
  private presenceConnected$ = new BehaviorSubject<boolean>(false);
  private notificationsConnected$ = new BehaviorSubject<boolean>(false);

  // Errors
  private errors$ = new Subject<string>();

  private config: WebSocketConfig = {
    wsUrl: this.getWsUrl(),
    reconnectInterval: 5000,
    maxReconnectAttempts: 5
  };

  private chatReconnectAttempts = 0;
  private presenceReconnectAttempts = 0;
  private notificationsReconnectAttempts = 0;
  private currentConversationId: number | null = null;
  
  // Speichere Token für Reconnects
  private chatToken: string = '';
  private presenceToken: string = '';
  private notificationsToken: string = '';

  constructor(private ngZone: NgZone) {}

  // ========================================================================
  // CHAT WEBSOCKET
  // ========================================================================

  /**
   * Verbinde zu Chat WebSocket für spezifische Konversation
   */
  connectToChat(conversationId: number, accessToken: string): void {
    if (this.currentConversationId === conversationId && this.chatSocket?.readyState === WebSocket.OPEN) {
      return;  // Bereits verbunden
    }

    this.currentConversationId = conversationId;
    this.chatToken = accessToken;

    // Schließe alte Verbindung
    if (this.chatSocket) {
      this.chatSocket.close();
    }

    // JWT Token holen (für Authentication)
    const token = accessToken;
    const url = `${this.config.wsUrl}ws/chat/${conversationId}/?token=${token}`;

    this.ngZone.runOutsideAngular(() => {
      this.chatSocket = new WebSocket(url);

      this.chatSocket.onopen = () => {
        this.ngZone.run(() => {
          this.chatConnected$.next(true);
          this.chatReconnectAttempts = 0;
        });
      };

      this.chatSocket.onmessage = (event) => {
        this.ngZone.run(() => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            this.handleChatMessage(data);
          } catch (e) {
            console.error('Fehler beim Parsen der Chat-Nachricht:', e);
          }
        });
      };

      this.chatSocket.onerror = (error) => {
        this.ngZone.run(() => {
          console.error('Chat WebSocket Fehler:', error);
          this.errors$.next('Chat WebSocket Fehler');
          this.chatConnected$.next(false);
        });
      };

      this.chatSocket.onclose = () => {
        this.ngZone.run(() => {
          this.chatConnected$.next(false);
          this.attemptChatReconnect();
        });
      };
    });
  }

  /**
   * Trenne von Chat WebSocket
   */
  disconnectFromChat(): void {
    if (this.chatSocket) {
      this.chatSocket.close();
      this.chatSocket = null;
      this.currentConversationId = null;
    }
  }

  /**
   * Sende Chat-Nachricht über WebSocket
   */
  sendMessage(content: string, isEncrypted: boolean = false, messageType: 'text' | 'file' | 'image' = 'text', replyTo?: number): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      this.errors$.next('Chat nicht verbunden');
      return;
    }

    const message = {
      type: 'message',
      content,
      message_type: messageType,
      is_encrypted: isEncrypted,
      reply_to: replyTo
    };

    this.chatSocket.send(JSON.stringify(message));
  }

  /**
   * Sende Typing Indicator
   */
  sendTypingIndicator(isTyping: boolean): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'typing',
      is_typing: isTyping
    };

    this.chatSocket.send(JSON.stringify(message));
  }

  /**
   * Markiere Nachricht als gelesen
   */
  markMessageAsRead(messageId: number): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'mark_read',
      message_id: messageId
    };

    this.chatSocket.send(JSON.stringify(message));
  }

  /**
   * Füge Emoji-Reaktion hinzu
   */
  addReaction(messageId: number, emoji: string): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'reaction',
      message_id: messageId,
      emoji
    };

    this.chatSocket.send(JSON.stringify(message));
  }

  // ========================================================================
  // PRESENCE WEBSOCKET
  // ========================================================================

  /**
   * Verbinde zu Presence WebSocket
   */
  connectToPresence(accessToken: string): void {
    if (this.presenceSocket?.readyState === WebSocket.OPEN) {
      return;  // Bereits verbunden
    }

    this.presenceToken = accessToken;

    // JWT Token holen (für Authentication)
    const token = accessToken;
    const url = `${this.config.wsUrl}ws/presence/?token=${token}`;

    this.ngZone.runOutsideAngular(() => {
      this.presenceSocket = new WebSocket(url);

      this.presenceSocket.onopen = () => {
        this.ngZone.run(() => {
          this.presenceConnected$.next(true);
          this.presenceReconnectAttempts = 0;
        });
      };

      this.presenceSocket.onmessage = (event) => {
        this.ngZone.run(() => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            this.handlePresenceMessage(data);
          } catch (e) {
            console.error('Fehler beim Parsen der Presence-Nachricht:', e);
          }
        });
      };

      this.presenceSocket.onerror = (error) => {
        this.ngZone.run(() => {
          console.error('Presence WebSocket Fehler:', error);
          this.errors$.next('Presence WebSocket Fehler');
          this.presenceConnected$.next(false);
        });
      };

      this.presenceSocket.onclose = () => {
        this.ngZone.run(() => {
          this.presenceConnected$.next(false);
          this.attemptPresenceReconnect();
        });
      };
    });
  }

  /**
   * Trenne von Presence WebSocket
   */
  disconnectFromPresence(): void {
    if (this.presenceSocket) {
      this.presenceSocket.close();
      this.presenceSocket = null;
    }
  }

  /**
   * Trenne ALLE WebSocket-Verbindungen (für Logout)
   */
  disconnectAll(): void {
    this.disconnectFromChat();
    this.disconnectFromPresence();
    this.disconnectFromNotifications();
  }

  /**
   * Update User Status
   */
  updateUserStatus(status: 'online' | 'away' | 'busy' | 'offline', message?: string): void {
    if (!this.presenceSocket || this.presenceSocket.readyState !== WebSocket.OPEN) {
      this.errors$.next('Presence nicht verbunden');
      return;
    }

    const msg = {
      type: 'status_change',
      status,
      message: message || ''
    };

    this.presenceSocket.send(JSON.stringify(msg));
  }

  // ========================================================================
  // NOTIFICATIONS WEBSOCKET
  // ========================================================================

  /**
   * Verbinde zu Notifications WebSocket
   */
  connectToNotifications(accessToken: string): void {
    if (this.notificationsSocket?.readyState === WebSocket.OPEN) {
      return;  // Bereits verbunden
    }

    this.notificationsToken = accessToken;

    // JWT Token holen (für Authentication)
    const token = accessToken;
    const url = `${this.config.wsUrl}ws/notifications/?token=${token}`;

    this.ngZone.runOutsideAngular(() => {
      this.notificationsSocket = new WebSocket(url);

      this.notificationsSocket.onopen = () => {
        this.ngZone.run(() => {
          this.notificationsConnected$.next(true);
          this.notificationsReconnectAttempts = 0;
        });
      };

      this.notificationsSocket.onmessage = (event) => {
        this.ngZone.run(() => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            this.handleNotificationMessage(data);
          } catch (e) {
            console.error('Fehler beim Parsen der Notification:', e);
          }
        });
      };

      this.notificationsSocket.onerror = (error) => {
        this.ngZone.run(() => {
          console.error('Notifications WebSocket Fehler:', error);
          this.errors$.next('Notifications WebSocket Fehler');
          this.notificationsConnected$.next(false);
        });
      };

      this.notificationsSocket.onclose = () => {
        this.ngZone.run(() => {
          this.notificationsConnected$.next(false);
          this.attemptNotificationsReconnect();
        });
      };
    });
  }

  /**
   * Trenne von Notifications WebSocket
   */
  disconnectFromNotifications(): void {
    if (this.notificationsSocket) {
      this.notificationsSocket.close();
      this.notificationsSocket = null;
    }
  }


  // ========================================================================
  // MESSAGE HANDLERS
  // ========================================================================

  private handleChatMessage(data: WebSocketMessage): void {
    switch (data.type) {
      case 'message':
      case 'chat_message':  // HTTP API sendet chat_message statt message
        this.chatMessages$.next(data as ChatMessagePayload);
        break;
      case 'message_update':
        this.messageUpdates$.next(data);
        break;
      case 'typing':
        this.typingIndicators$.next(data as TypingIndicatorPayload);
        break;
      case 'reaction':
        this.messageReactions$.next(data as ReactionPayload);
        break;
      case 'user_joined':
        this.userJoined$.next(data);
        break;
      case 'user_left':
        this.userLeft$.next(data);
        break;
      case 'error':
        this.errors$.next(data['message']);
        break;
    }
  }

  private handlePresenceMessage(data: WebSocketMessage): void {
    switch (data.type) {
      case 'status_changed':
        this.statusChanges$.next(data as StatusChangedPayload);
        break;
      case 'online_users_list':
        // Initiale Liste aller online User beim Connect
        if (data['users'] && Array.isArray(data['users'])) {
          const usernames = data['users'].map((u: any) => u.username);
          this.onlineUsers$.next(usernames);
        }
        break;
      case 'error':
        this.errors$.next(data['message']);
        break;
    }
  }

  private handleNotificationMessage(data: WebSocketMessage): void {
    switch (data.type) {
      case 'new_message':
        // Neue Nachricht als Benachrichtigung
        this.newMessageNotifications$.next(data as ChatMessagePayload);
        break;
      case 'reaction':
        // Reaktion als Nachricht-Notification behandeln (für Badge)
        this.newMessageNotifications$.next(data as ChatMessagePayload);
        break;
      case 'error':
        this.errors$.next(data['message']);
        break;
    }
  }

  // ========================================================================
  // RECONNECTION
  // ========================================================================

  private attemptChatReconnect(): void {
    if (this.chatReconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      this.errors$.next('Chat WebSocket: Max reconnect attempts erreicht');
      return;
    }

    this.chatReconnectAttempts++;
    const delay = (this.config.reconnectInterval || 5000) * this.chatReconnectAttempts;

    setTimeout(() => {
      if (this.currentConversationId && this.chatToken) {
        this.connectToChat(this.currentConversationId, this.chatToken);
      }
    }, delay);
  }

  private attemptPresenceReconnect(): void {
    if (this.presenceReconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      this.errors$.next('Presence WebSocket: Max reconnect attempts erreicht');
      return;
    }

    this.presenceReconnectAttempts++;
    const delay = (this.config.reconnectInterval || 5000) * this.presenceReconnectAttempts;

    setTimeout(() => {
      if (this.presenceToken) {
        this.connectToPresence(this.presenceToken);
      }
    }, delay);
  }

  private attemptNotificationsReconnect(): void {
    if (this.notificationsReconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      this.errors$.next('Notifications WebSocket: Max reconnect attempts erreicht');
      return;
    }

    this.notificationsReconnectAttempts++;
    const delay = (this.config.reconnectInterval || 5000) * this.notificationsReconnectAttempts;

    setTimeout(() => {
      if (this.notificationsToken) {
        this.connectToNotifications(this.notificationsToken);
      }
    }, delay);
  }

  // ========================================================================
  // OBSERVABLES
  // ========================================================================

  getChatMessages$(): Observable<ChatMessagePayload> {
    return this.chatMessages$.asObservable();
  }

  getMessageUpdates$(): Observable<any> {
    return this.messageUpdates$.asObservable();
  }

  getTypingIndicators$(): Observable<TypingIndicatorPayload> {
    return this.typingIndicators$.asObservable();
  }

  getMessageReactions$(): Observable<ReactionPayload> {
    return this.messageReactions$.asObservable();
  }

  getUserJoined$(): Observable<any> {
    return this.userJoined$.asObservable();
  }

  getUserLeft$(): Observable<any> {
    return this.userLeft$.asObservable();
  }

  getStatusChanges$(): Observable<StatusChangedPayload> {
    return this.statusChanges$.asObservable();
  }

  getOnlineUsers$(): Observable<string[]> {
    return this.onlineUsers$.asObservable();
  }

  isChatConnected$(): Observable<boolean> {
    return this.chatConnected$.asObservable();
  }

  isPresenceConnected$(): Observable<boolean> {
    return this.presenceConnected$.asObservable();
  }

  getErrors$(): Observable<string> {
    return this.errors$.asObservable();
  }

  getNewMessageNotifications$(): Observable<ChatMessagePayload> {
    return this.newMessageNotifications$.asObservable();
  }

  isNotificationsConnected$(): Observable<boolean> {
    return this.notificationsConnected$.asObservable();
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private getWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/`;
  }

  disconnect(): void {
    this.disconnectFromChat();
    this.disconnectFromPresence();
    this.disconnectFromNotifications();
  }
}
