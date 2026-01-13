// Member Detail Modal Component
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonBadge,
  IonList,
  IonItem,
  IonLabel,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, mailOutline, callOutline } from 'ionicons/icons';
import { OrgChartMember } from '../../../models/intranet.models';

@Component({
  selector: 'app-member-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonBadge,
    IonList,
    IonItem,
    IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ member.full_name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="member-details">
        @if (member.avatar) {
          <img [src]="member.avatar" alt="Avatar" class="avatar" />
        }
        
        <h2>{{ member.full_name }}</h2>
        
        <ion-badge [color]="getRoleBadgeColor(member.role.hierarchy_level)">
          {{ member.role.name }}
        </ion-badge>
        
        @if (member.position_title) {
          <p class="position-title">{{ member.position_title }}</p>
        }

        <ion-list>
          <ion-item>
            <ion-icon name="mail-outline" slot="start"></ion-icon>
            <ion-label>
              <a [href]="'mailto:' + member.email">{{ member.email }}</a>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  `,
  styles: [`
    .member-details {
      text-align: center;
      
      .avatar {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        margin: 20px auto;
        display: block;
        object-fit: cover;
      }

      h2 {
        margin: 16px 0 8px 0;
      }

      .position-title {
        color: var(--ion-color-medium);
        margin: 8px 0 24px 0;
      }

      ion-badge {
        margin: 8px 0;
      }

      ion-list {
        margin-top: 24px;
      }
    }
  `]
})
export class MemberDetailModalComponent {
  @Input() member!: OrgChartMember;

  constructor(private modalCtrl: ModalController) {
    addIcons({ closeOutline, mailOutline, callOutline });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  getRoleBadgeColor(level: number): string {
    if (level === 1) return 'danger';
    if (level === 2) return 'warning';
    if (level === 3) return 'primary';
    return 'success';
  }
}
