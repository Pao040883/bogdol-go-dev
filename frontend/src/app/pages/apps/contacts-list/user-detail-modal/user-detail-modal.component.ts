import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonLabel,
  IonItem,
  IonList,
  IonListHeader,
  IonAvatar,
  IonBadge,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  close,
  mail,
  call,
  person,
  briefcase,
  star,
  people,
  swapHorizontal,
  ribbon,
  calendar,
  chatbubble,
} from 'ionicons/icons';
import { UserPhonebookEntry } from '../../../../core/interfaces/user-phonebook.types';
import { UserSpecialtiesCardComponent } from '../../../../shared/components/user-specialties-card/user-specialties-card.component';
import { OrganizationService } from '../../../../core/services/organization.service';
import { DepartmentMemberDetail, SubstituteAssignment } from '../../../../models/organization.model';

@Component({
  selector: 'app-user-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonLabel,
    IonItem,
    IonList,
    IonListHeader,
    IonAvatar,
    IonBadge,
    IonSpinner,
    UserSpecialtiesCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ user.first_name }} {{ user.last_name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (user) {
        <!-- User Info Card -->
        <ion-card>
          <ion-card-content>
            <div class="user-header">
              <ion-avatar class="large-avatar">
                <div class="avatar-placeholder">
                  <ion-icon name="person"></ion-icon>
                </div>
              </ion-avatar>
              <div class="user-info">
                <h1>{{ user.first_name }} {{ user.last_name }}</h1>
                <p>{{ user.company }}</p>
              </div>
            </div>

            <ion-list lines="none">
              @if (user.email) {
                <ion-item>
                  <ion-icon name="mail" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <a [href]="'mailto:' + user.email">{{ user.email }}</a>
                  </ion-label>
                </ion-item>
              }
              @if (user.phone_number) {
                <ion-item>
                  <ion-icon name="call" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <a [href]="'tel:' + user.phone_number">{{ user.phone_number }}</a>
                  </ion-label>
                </ion-item>
              }
              @if (user.mobile_number) {
                <ion-item>
                  <ion-icon name="call" slot="start" color="primary"></ion-icon>
                  <ion-label>
                    <a [href]="'tel:' + user.mobile_number">{{ user.mobile_number }}</a>
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Department Memberships -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="briefcase"></ion-icon>
              Abteilungs-Zugehörigkeiten
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (isLoadingMemberships()) {
              <div class="loading-container">
                <ion-spinner></ion-spinner>
                <p>Lade Zugehörigkeiten...</p>
              </div>
            } @else if (departmentMemberships().length === 0) {
              <div class="empty-state">
                <ion-icon name="briefcase"></ion-icon>
                <p>Keine Abteilungs-Zugehörigkeiten</p>
              </div>
            } @else {
              <div class="memberships-list">
                @for (membership of departmentMemberships(); track membership.id) {
                  <div class="membership-item" [class.primary]="membership.is_primary">
                    <div class="membership-header">
                      <div class="department-info">
                        <strong>{{ membership.department_name || 'Unbekannt' }}</strong>
                        @if (membership.is_staff_position) {
                          <ion-chip color="warning" size="small">
                            <ion-icon name="briefcase"></ion-icon>
                            <ion-label>Stabsstelle</ion-label>
                          </ion-chip>
                        }
                      </div>
                      @if (membership.is_primary) {
                        <ion-badge color="warning">
                          <ion-icon name="star"></ion-icon>
                          Primär
                        </ion-badge>
                      }
                    </div>
                    <div class="membership-details">
                      <ion-chip color="primary" size="small">
                        <ion-label>{{ membership.role_name || 'Keine Rolle' }}</ion-label>
                      </ion-chip>
                      @if (membership.position_title) {
                        <p class="position-title">{{ membership.position_title }}</p>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </ion-card-content>
        </ion-card>

        <!-- Specialties (Fachbereiche) -->
        <app-user-specialties-card [userId]="user.id"></app-user-specialties-card>

        <!-- Active Substitutions -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="swap-horizontal"></ion-icon>
              Vertretungen
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            @if (isLoadingSubstitutions()) {
              <div class="loading-container">
                <ion-spinner></ion-spinner>
                <p>Lade Vertretungen...</p>
              </div>
            } @else if (mySubstitutions().i_substitute.length === 0 && mySubstitutions().substituted_by.length === 0) {
              <div class="empty-state">
                <ion-icon name="swap-horizontal"></ion-icon>
                <p>Keine aktiven Vertretungen</p>
              </div>
            } @else {
              <!-- User vertritt andere -->
              @if (mySubstitutions().i_substitute.length > 0) {
                <ion-list-header>
                  <ion-label>Vertritt folgende Personen:</ion-label>
                </ion-list-header>
                @for (sub of mySubstitutions().i_substitute; track sub.id) {
                  <div class="substitution-item outgoing">
                    <div class="substitution-header">
                      <ion-icon name="people" color="primary"></ion-icon>
                      <strong>{{ sub.original_user_name }}</strong>
                    </div>
                    <div class="substitution-details">
                      <ion-chip size="small" color="primary">
                        <ion-icon name="calendar"></ion-icon>
                        <ion-label>
                          {{ sub.absence_data?.start_date | date:'dd.MM.yyyy' }} - 
                          {{ sub.absence_data?.end_date | date:'dd.MM.yyyy' }}
                        </ion-label>
                      </ion-chip>
                      @if (sub.specialties && sub.specialties.length > 0) {
                        <div class="specialty-chips">
                          @for (spec of sub.specialties; track spec) {
                            <ion-chip size="small" color="secondary">
                              <ion-icon name="ribbon"></ion-icon>
                              <ion-label>{{ spec }}</ion-label>
                            </ion-chip>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }

              <!-- User wird vertreten -->
              @if (mySubstitutions().substituted_by.length > 0) {
                <ion-list-header>
                  <ion-label>Wird vertreten von:</ion-label>
                </ion-list-header>
                @for (sub of mySubstitutions().substituted_by; track sub.id) {
                  <div class="substitution-item incoming">
                    <div class="substitution-header">
                      <ion-icon name="people" color="success"></ion-icon>
                      <strong>{{ sub.substitute_user_name }}</strong>
                    </div>
                    <div class="substitution-details">
                      <ion-chip size="small" color="success">
                        <ion-icon name="calendar"></ion-icon>
                        <ion-label>
                          {{ sub.absence_data?.start_date | date:'dd.MM.yyyy' }} - 
                          {{ sub.absence_data?.end_date | date:'dd.MM.yyyy' }}
                        </ion-label>
                      </ion-chip>
                    </div>
                  </div>
                }
              }
            }
          </ion-card-content>
        </ion-card>

        <!-- Actions -->
        <div class="action-buttons">
          <ion-button expand="block" (click)="sendMessage()">
            <ion-icon name="chatbubble" slot="start"></ion-icon>
            Nachricht senden
          </ion-button>
          @if (user.email) {
            <ion-button expand="block" fill="outline" [href]="'mailto:' + user.email">
              <ion-icon name="mail" slot="start"></ion-icon>
              E-Mail senden
            </ion-button>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .user-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .large-avatar {
      width: 80px;
      height: 80px;

      .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--ion-color-light);
        
        ion-icon {
          font-size: 40px;
          color: var(--ion-color-medium);
        }
      }
    }

    .user-info {
      flex: 1;

      h1 {
        margin: 0 0 4px 0;
        font-size: 24px;
        font-weight: 700;
      }

      p {
        margin: 0;
        color: var(--ion-color-medium);
      }
    }

    ion-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;

      ion-icon {
        font-size: 20px;
        color: var(--ion-color-primary);
      }
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;

      ion-spinner {
        margin-bottom: 10px;
      }

      p {
        color: var(--ion-color-medium);
        margin: 0;
      }
    }

    .empty-state {
      text-align: center;
      padding: 30px 20px;
      color: var(--ion-color-medium);

      ion-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .memberships-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .membership-item {
      padding: 12px;
      border: 1px solid var(--ion-color-light-shade);
      border-radius: 8px;
      background: var(--ion-color-light);

      &.primary {
        background: linear-gradient(135deg, #fff9e6 0%, #fff3cc 100%);
        border-color: var(--ion-color-warning);
        border-width: 2px;
      }
    }

    .membership-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .department-info {
      display: flex;
      align-items: center;
      gap: 8px;

      strong {
        font-size: 16px;
      }

      ion-chip {
        margin: 0;
      }
    }

    .membership-details {
      display: flex;
      flex-direction: column;
      gap: 6px;

      ion-chip {
        align-self: flex-start;
        margin: 0;
      }

      .position-title {
        margin: 0;
        font-size: 14px;
        color: var(--ion-color-medium-shade);
        font-style: italic;
      }
    }

    .substitution-item {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;

      &.outgoing {
        background: rgba(var(--ion-color-primary-rgb), 0.1);
        border-left: 4px solid var(--ion-color-primary);
      }

      &.incoming {
        background: rgba(var(--ion-color-success-rgb), 0.1);
        border-left: 4px solid var(--ion-color-success);
      }
    }

    .substitution-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      ion-icon {
        font-size: 20px;
      }

      strong {
        font-size: 15px;
      }
    }

    .substitution-details {
      display: flex;
      flex-direction: column;
      gap: 6px;

      ion-chip {
        align-self: flex-start;
        margin: 0;
      }

      .specialty-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
    }

    ion-list-header {
      padding-top: 16px;
      font-weight: 700;
    }

    .action-buttons {
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `],
})
export class UserDetailModalComponent implements OnInit {
  @Input() user!: UserPhonebookEntry;

  departmentMemberships = signal<DepartmentMemberDetail[]>([]);
  mySubstitutions = signal<{ i_substitute: SubstituteAssignment[], substituted_by: SubstituteAssignment[] }>({
    i_substitute: [],
    substituted_by: [],
  });
  isLoadingMemberships = signal(false);
  isLoadingSubstitutions = signal(false);

  constructor(
    private modalController: ModalController,
    private organizationService: OrganizationService
  ) {
    addIcons({
      close,
      mail,
      call,
      person,
      briefcase,
      star,
      people,
      swapHorizontal,
      ribbon,
      calendar,
      chatbubble,
    });
  }

  ngOnInit() {
    this.loadDepartmentMemberships();
    this.loadSubstitutions();
  }

  loadDepartmentMemberships() {
    if (!this.user?.id) return;

    this.isLoadingMemberships.set(true);
    this.organizationService.getDepartmentMembers({ user: this.user.id }).subscribe({
      next: (members) => {
        this.departmentMemberships.set(members);
        this.isLoadingMemberships.set(false);
      },
      error: (error) => {
        console.error('Error loading department memberships:', error);
        this.isLoadingMemberships.set(false);
      },
    });
  }

  loadSubstitutions() {
    if (!this.user?.id) return;

    this.isLoadingSubstitutions.set(true);
    this.organizationService.getMySubstitutions().subscribe({
      next: (subs) => {
        this.mySubstitutions.set(subs);
        this.isLoadingSubstitutions.set(false);
      },
      error: (error) => {
        console.error('Error loading substitutions:', error);
        this.isLoadingSubstitutions.set(false);
      },
    });
  }

  sendMessage() {
    this.modalController.dismiss({ action: 'message', user: this.user });
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
