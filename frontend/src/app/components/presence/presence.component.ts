/**
 * Presence Component für Online-Status Anzeige
 */
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { UserPresence, StatusChangedPayload } from '../../models/intranet.models';
import { IntranetApiService } from '../../services/intranet-api.service';
import { IntranetWebSocketService } from '../../services/intranet-websocket.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-presence',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './presence.component.html',
  styleUrls: ['./presence.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresenceComponent implements OnInit, OnDestroy {
  isConnected = false;
  currentStatus: 'online' | 'away' | 'busy' | 'offline' = 'online';
  statusMessage = '';
  onlineUsers: Map<string, UserPresence> = new Map();

  private destroy$ = new Subject<void>();
  private userPresences$ = new BehaviorSubject<UserPresence[]>([]);

  constructor(
    private apiService: IntranetApiService,
    private wsService: IntranetWebSocketService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadPresence();
    this.connectToPresence();
    this.subscribeToPresenceUpdates();
  }

  ngOnDestroy(): void {
    this.wsService.disconnectFromPresence();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========================================================================
  // LOAD DATA
  // ========================================================================

  private loadPresence(): void {
    this.apiService.getPresence()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.onlineUsers.clear();
          response.results.forEach(presence => {
            if (presence.status === 'online') {
              this.onlineUsers.set(presence.username, presence);
            }
          });
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Fehler beim Laden der Presence:', err);
          this.cdr.markForCheck();
        }
      });
  }

  // ========================================================================
  // WEBSOCKET
  // ========================================================================

  private connectToPresence(): void {
    const token = this.authService.accessToken() || '';
    this.wsService.connectToPresence(token);
  }

  private subscribeToPresenceUpdates(): void {
    // Status Changes
    this.wsService.getStatusChanges$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((update: StatusChangedPayload) => {
        if (update.status === 'online') {
          this.onlineUsers.set(update.username, {
            username: update.username,
            full_name: update.full_name,
            status: 'online',
            status_message: update.status_message,
            is_available_for_chat: true,
            last_seen: new Date().toISOString()
          });
        } else {
          this.onlineUsers.delete(update.username);
        }
        this.cdr.markForCheck();
      });

    // Connection Status
    this.wsService.isPresenceConnected$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(connected => {
        this.isConnected = connected;
        this.cdr.markForCheck();
        if (connected) {
          // Setze aktuellen Status
          this.updateStatus();
        }
      });
  }

  // ========================================================================
  // STATUS MANAGEMENT
  // ========================================================================

  updateStatus(): void {
    this.wsService.updateUserStatus(this.currentStatus, this.statusMessage);
  }

  setOnline(): void {
    this.currentStatus = 'online';
    this.statusMessage = '';
    this.updateStatus();
  }

  setAway(): void {
    this.currentStatus = 'away';
    this.statusMessage = 'Bin gleich zurück';
    this.updateStatus();
  }

  setBusy(): void {
    this.currentStatus = 'busy';
    this.statusMessage = 'Im Gespräch';
    this.updateStatus();
  }

  setCustomStatus(): void {
    this.currentStatus = 'online';
    this.updateStatus();
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  getStatusIcon(status: string): string {
    switch (status) {
      case 'online':
        return '🟢';
      case 'away':
        return '🟡';
      case 'busy':
        return '🔴';
      case 'offline':
        return '⚪';
      default:
        return '⚪';
    }
  }

  getOnlineUsersList(): UserPresence[] {
    return Array.from(this.onlineUsers.values());
  }

  getOnlineCount(): number {
    return this.onlineUsers.size;
  }
}
