import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ModalController } from '@ionic/angular';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonMenuButton,
  IonButton, IonIcon, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonList, IonItem, IonLabel, IonBadge, IonSearchbar,
  IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, documentText, calendar, person, business, location,
  time, alertCircle, ellipsisHorizontal, search, filter, people
} from 'ionicons/icons';
import { WorkOrderService } from '../../../core/services/workorder.service';
import { WorkOrder } from '../../../core/interfaces/workorder.types';
import { WorkorderAssignmentModalComponent } from '../../../components/workorder-assignment-modal/workorder-assignment-modal.component';

@Component({
  selector: 'app-work-tickets',
  templateUrl: './work-tickets.page.html',
  styleUrls: ['./work-tickets.page.scss'],
  standalone: true,
  imports: [
    IonCol, IonRow, IonGrid, IonFabButton, IonFab, IonRefresherContent, IonRefresher, 
    IonSelectOption, IonSelect, IonSearchbar, IonBadge, IonLabel, IonItem, 
    IonList, IonCardContent, IonCardTitle, IonCardHeader, IonCard, IonIcon, IonButton, 
    IonMenuButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar,
    CommonModule, FormsModule, RouterLink
  ],
})
export class WorkTicketsPage implements OnInit {
  private readonly workOrderService = inject(WorkOrderService);
  private readonly router = inject(Router);
  private readonly modalController = inject(ModalController);

  searchTerm = '';
  statusFilter = 'all';
  workOrders: WorkOrder[] = [];
  isLoading = false;

  get filteredOrders(): WorkOrder[] {
    let filtered = this.workOrders;
    
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === this.statusFilter);
    }
    
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(search) ||
        o.project_number?.toLowerCase().includes(search) ||
        o.client_name?.toLowerCase().includes(search) ||
        o.work_type.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }

  constructor() {
    addIcons({
      add, documentText, business, location, calendar, time, person,
      alertCircle, ellipsisHorizontal, search, filter, people
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.workOrderService.loadWorkOrders().subscribe({
      next: (orders) => {
        this.workOrders = orders;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  async doRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  onSearchChanged(event: any) {
    this.searchTerm = event.detail.value;
  }

  onStatusFilterChanged(event: any) {
    this.statusFilter = event.detail.value;
  }

  openCreateModal() {
    this.router.navigate(['/apps/work-tickets/create']);
  }

  openDetails(order: WorkOrder) {
    this.router.navigate(['/apps/work-tickets', order.id]);
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'draft': 'medium',
      'in_progress': 'primary',
      'completed': 'success',
      'signed': 'success',
      'invoiced': 'tertiary',
      'cancelled': 'danger'
    };
    return colors[status] || 'medium';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }

  formatDateRange(start: string, end: string): string {
    return `${this.formatDate(start)} - ${this.formatDate(end)}`;
  }
  
  async openWorkorderAssignmentModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: WorkorderAssignmentModalComponent,
      cssClass: 'workorder-assignment-modal'
    });
    await modal.present();
  }
}
