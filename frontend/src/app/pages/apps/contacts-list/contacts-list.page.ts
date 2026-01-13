import {
  Component,
  effect,
  inject,
  OnInit,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonButtons,
  IonBackButton,
  IonLabel,
  IonAccordion,
  IonAccordionGroup,
  IonSearchbar,
  IonIcon,
  IonButton,
  IonChip,
  IonList,
  IonBadge,
  IonModal,
  IonTextarea,
  IonFooter,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { happyOutline, sadOutline, alertCircle, person, radioOutline, chatbubbleOutline, peopleOutline, listOutline, sparklesOutline, analytics, searchOutline, personOutline, arrowForward } from 'ionicons/icons';
import { Subject, of, throwError } from 'rxjs';
import { takeUntil, switchMap, finalize, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Users } from 'src/app/core/interfaces/users';
import { UserPhonebookService } from 'src/app/core/services/user-phonebook.service';
import { UserPhonebookEntry } from 'src/app/core/interfaces/user-phonebook.types';
import { IntranetApiService } from '../../../services/intranet-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { IntranetWebSocketService } from '../../../services/intranet-websocket.service';
import { UserPresence } from '../../../models/intranet.models';
import { UserDetailModalComponent } from './user-detail-modal/user-detail-modal.component';
import { ModalController } from '@ionic/angular/standalone';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-contacts-list',
  templateUrl: './contacts-list.page.html',
  styleUrls: ['./contacts-list.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonIcon,
    IonSearchbar,
    IonAccordionGroup,
    IonAccordion,
    IonLabel,
    IonBackButton,
    IonButtons,
    IonItem,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonChip,
    IonList,
    IonBadge,
    IonModal,
    IonTextarea,
    IonFooter,
    IonText,
    CommonModule,
    FormsModule,
  ],
})
export class ContactsListPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  @ViewChild('searchbar', { static: false }) searchbar!: IonSearchbar;
  readonly userService = inject(UserPhonebookService);
  private http = inject(HttpClient);
  public expandedAccordion: number | null = null;
  public data = signal<UserPhonebookEntry[]>([]);
  public results = signal<UserPhonebookEntry[]>([]);
  
  // KI-Suche
  public searchMode = signal<'normal' | 'semantic'>('semantic');
  public searchQuery = signal<string>('');
  
  // Intranet Services
  private intranetApi = inject(IntranetApiService);
  private wsService = inject(IntranetWebSocketService);
  private toastService = inject(ToastService);
  private modalController = inject(ModalController);
  private destroy$ = new Subject<void>();

  // Presence tracking
  private onlineUsersMap = new Map<string, UserPresence>();
  // Message modal state
  showMessageModal = false;
  messageText = '';
  selectedUser: UserPhonebookEntry | null = null;
  isSending = false;
  autocompleteOptions: string[] = [];
  showAutocomplete = false;
  suppressAutocomplete = false;
  relatedQueries: string[] = [];
  // public data: UserPhonebookEntry[] = this.userService.entries();
  // public results = [...this.data];

  handleInput(event: Event) {
    const target = event.target as HTMLIonSearchbarElement;
    const query = target.value?.toLowerCase() || '';
    
    this.searchQuery.set(query);
    
    if (!query || query.length < 2) {
      // Zurück zur vollständigen Liste
      this.results.set([...this.data()]);
      this.relatedQueries = [];
      return;
    }
    
    if (this.searchMode() === 'semantic') {
      // KI-gestützte Suche
      this.userService.searchSemantic(query)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (results) => {
            // Wenn weniger als 3 Ergebnisse, KI-Ergebnisse zuerst + restliche User darunter
            if (results.length < 3) {
              const resultIds = new Set(results.map((r: any) => r.id));
              const remaining = this.data().filter(d => !resultIds.has(d.id));
              this.results.set([...results, ...remaining] as UserPhonebookEntry[]);
            } else {
              this.results.set(results as UserPhonebookEntry[]);
            }
            
            // Lade verwandte Queries
            this.userService.getRelatedQueries(query)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (related) => {
                  this.relatedQueries = related;
                },
                error: (err) => console.error('Related queries failed:', err)
              });
          },
          error: (err) => {
            console.error('Semantic search failed:', err);
            // Fallback auf normale Suche
            this.performNormalSearch(query);
          }
        });
    } else {
      // Normale Textsuche
      this.performNormalSearch(query);
    }
  }
  
  selectAutocompleteOption(suggestion: string) {
    this.searchQuery.set(suggestion);
    
    // Trigger search with selected suggestion
    const searchbar = document.querySelector('ion-searchbar') as HTMLIonSearchbarElement;
    if (searchbar) {
      searchbar.value = suggestion;
      this.handleInput({ target: searchbar } as any);
    }
  }
  
  private performNormalSearch(query: string) {
    this.results.set(
      this.data().filter((d) => 
        d.first_name.toLowerCase().includes(query) ||
        d.last_name.toLowerCase().includes(query) ||
        d.email?.toLowerCase().includes(query) ||
        (d as any).job_title?.toLowerCase().includes(query) ||
        (d as any).department_name?.toLowerCase().includes(query)
      )
    );
  }
  
  toggleSearchMode() {
    this.searchMode.set(this.searchMode() === 'normal' ? 'semantic' : 'normal');
    this.userService.toggleSemanticSearch();
    
    // Re-search wenn Query existiert
    if (this.searchQuery()) {
      const event = { target: { value: this.searchQuery() } } as any;
      this.handleInput(event);
    }
  }
  constructor() {
    addIcons({sparklesOutline,searchOutline,arrowForward,analytics,chatbubbleOutline,personOutline,alertCircle,person,radioOutline,sadOutline,happyOutline,peopleOutline,listOutline});

    effect(() => {
      const newData = this.userService.entries();
      this.data.set(newData);
      this.results.set([...newData]);
    });
  }

  ionViewWillEnter() {
    this.userService.loadPhonebook();
    this.loadPresence();
    this.connectPresence();
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.wsService.disconnectFromPresence();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =================================================================
  // PRESENCE
  // =================================================================

  private loadPresence() {
    this.intranetApi.getPresence()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // NICHT clearen! Das würde WebSocket-Updates überschreiben
          // Stattdessen: Ergänze/aktualisiere User-Daten aus API
          response.results.forEach(presence => {
            if (presence.status === 'online' || presence.status === 'away' || presence.status === 'busy') {
              // Update oder füge hinzu
              this.onlineUsersMap.set(presence.username, presence);
            }
          });
        },
        error: (err) => console.error('Error loading presence:', err)
      });
  }

  private connectPresence() {
    const token = this.authService.accessToken() || '';
    this.wsService.connectToPresence(token);

    // Initiale Online-User-Liste beim Connect (gleiche Logik wie chat-list)
    this.wsService.getOnlineUsers$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((usernames) => {
        // Synchronisiere Map mit WebSocket-Liste
        // Entferne User die nicht mehr online sind
        const onlineSet = new Set(usernames);
        for (const [username, _] of this.onlineUsersMap.entries()) {
          if (!onlineSet.has(username)) {
            this.onlineUsersMap.delete(username);
          }
        }
        // Füge neue online User hinzu (mit minimal info, wird durch getPresence API ergänzt)
        usernames.forEach(username => {
          if (!this.onlineUsersMap.has(username)) {
            this.onlineUsersMap.set(username, {
              username: username,
              full_name: username, // wird durch API oder Status-Update aktualisiert
              status: 'online',
              status_message: '',
              is_available_for_chat: true,
              last_seen: new Date().toISOString()
            });
          }
        });
      });

    // Status-Änderungen in Realtime
    this.wsService.getStatusChanges$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        if (update.status === 'online' || update.status === 'away' || update.status === 'busy') {
          this.onlineUsersMap.set(update.username, {
            username: update.username,
            full_name: update.full_name,
            status: update.status,
            status_message: update.status_message,
            is_available_for_chat: true,
            last_seen: new Date().toISOString()
          });
        } else {
          this.onlineUsersMap.delete(update.username);
        }
      });
  }

  // Chat with user
  startChatWithUser(user: UserPhonebookEntry) {
    // Öffnet ein Modal zum direkten Senden einer Nachricht an diesen Kontakt
    this.selectedUser = user;
    this.messageText = '';
    this.showMessageModal = true;
  }

  // Helper für KI-Suche Relevanz-Anzeige
  getRelevanceScore(result: UserPhonebookEntry): number | null {
    return (result as any).relevance_score || null;
  }

  getMatchedFields(result: UserPhonebookEntry): any[] {
    return (result as any).matched_fields || [];
  }

  closeMessageModal() {
    this.showMessageModal = false;
    this.selectedUser = null;
    this.messageText = '';
  }
  
  sendMessageFromModal() {
    if (!this.selectedUser) return;
    const content = this.messageText.trim();
    if (!content) return;
  
    this.isSending = true;
    const target = this.selectedUser;

    // 1) Empfänger-Profil suchen (per E-Mail/Name, breit gefächert) -> User-ID ermitteln
    this.intranetApi.searchProfiles({ q: target.email || `${target.first_name} ${target.last_name}` })
      .pipe(
        map((res) => {
          // Beste Übereinstimmung zuerst: exakte E-Mail, dann exakter Name, sonst erster Treffer
          const exactEmail = res.results.find((p) => p.email?.toLowerCase() === target.email?.toLowerCase());
          if (exactEmail) return exactEmail;
          const exactName = res.results.find(
            (p) => `${p.first_name} ${p.last_name}`.toLowerCase() === `${target.first_name} ${target.last_name}`.toLowerCase()
          );
          if (exactName) return exactName;
          return res.results[0];
        }),
        switchMap((profile) => profile
          ? of(profile)
          : throwError(() => new Error('Empfänger nicht gefunden'))
        ),
        // 2) Prüfe ob bereits eine Konversation existiert
        switchMap((profile) => this.intranetApi.findConversationWithUser(profile.id).pipe(
          switchMap((existingConv) => {
            if (existingConv) {
              // Konversation existiert bereits, verwende diese
              return of(existingConv);
            } else {
              // Neue Konversation erstellen
              return this.intranetApi.createConversation({
                conversation_type: 'direct',
                participants: [profile.id],
              });
            }
          })
        )),
        // 3) Nachricht senden
        switchMap((conv) => this.intranetApi.sendMessage(conv.id, {
          message_type: 'text',
          content,
        })),
        finalize(() => this.isSending = false)
      )
      .subscribe({
        next: () => {
          this.closeMessageModal();
          this.toastService.success('Nachricht gesendet');
        },
        error: (err) => {
          console.error('Nachricht senden fehlgeschlagen', err);
          this.toastService.error(err?.message || 'Senden fehlgeschlagen');
        },
      });
  }

  isUserOnline(user: UserPhonebookEntry): boolean {
    // Suche nach Email oder Namen
    return Array.from(this.onlineUsersMap.values()).some(
      p => p.full_name === `${user.first_name} ${user.last_name}`
    );
  }

  getUserPresenceIcon(user: UserPhonebookEntry): string {
    if (user.is_absent) return 'sad-outline';
    const presence = Array.from(this.onlineUsersMap.values()).find(
      p => p.full_name === `${user.first_name} ${user.last_name}`
    );
    if (presence) {
      return this.getStatusIcon(presence.status);
    }
    return 'happy-outline';
  }

  getUserPresenceColor(user: UserPhonebookEntry): string {
    if (user.is_absent) return 'danger';
    const presence = Array.from(this.onlineUsersMap.values()).find(
      p => p.full_name === `${user.first_name} ${user.last_name}`
    );
    if (presence) {
      switch (presence.status) {
        case 'online': return 'success';
        case 'away': return 'warning';
        case 'busy': return 'danger';
      }
    }
    return 'medium';
  }

  private getStatusIcon(status: 'online' | 'away' | 'busy' | 'offline'): string {
    // Return registered Ionicon names for presence
    switch (status) {
      case 'online':
        return 'radio-outline';
      case 'away':
        return 'radio-outline';
      case 'busy':
        return 'alert-circle';
      default:
        return 'radio-outline';
    }
  }

  toggleAccordion(id: number) {
    const wasExpanded = this.expandedAccordion === id;
    this.expandedAccordion = wasExpanded ? null : id;
    
    // Track Klick beim AUFKLAPPEN (nicht beim Zuklappen) - auch für nicht-KI-Ergebnisse
    if (!wasExpanded && this.searchQuery()) {
      const user = this.results().find(r => r.id === id);
      if (user) {
        this.trackSearchClick(user);
      }
    }
  }

  setSubstitutionFilter(id: number | undefined) {
    const substitution = this.data().find((person) => person.id === id);
    if (!substitution) return;

    this.searchbar.value = substitution.first_name;
    const query = substitution.first_name.toLowerCase();
    this.results.set(
      this.data().filter((d) => d.first_name.toLowerCase().includes(query))
    );

    // Accordion schließen
    this.expandedAccordion = null;
  }

  async openUserDetail(user: UserPhonebookEntry) {
    
    // Track Klick auch für nicht-KI-Ergebnisse
    if (this.searchQuery()) {
      this.trackSearchClick(user);
    }

    const modal = await this.modalController.create({
      component: UserDetailModalComponent,
      componentProps: {
        user: user
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.action === 'message') {
      this.startChatWithUser(data.user);
    }
  }

  private trackSearchClick(user: UserPhonebookEntry) {
    const query = this.searchQuery();
    if (!query) {
      return;
    }

    // Finde Position in results
    const position = this.results().findIndex(r => r.id === user.id) + 1;
    const score = (user as any).score || 0;

    this.http.post(`${environment.apiUrl}/search/track-click/`, {
      query: query,
      profile_id: user.id,  // User-ID (nicht profile_id, da UserPhonebookEntry nur id hat)
      position: position,
      score: score
    }).subscribe({
      next: (response) => console.log('✅ Click tracked for learning:', response),
      error: (err) => console.error('❌ Click tracking failed:', err)
    });
  }
}
