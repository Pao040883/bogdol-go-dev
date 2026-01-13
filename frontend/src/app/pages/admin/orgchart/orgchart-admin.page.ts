import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { IntranetApiService } from '../../../services/intranet-api.service';
import { 
  Department, 
  DepartmentRole
} from '../../../models/intranet.models';

@Component({
  selector: 'app-orgchart-admin',
  templateUrl: './orgchart-admin.page.html',
  styleUrls: ['./orgchart-admin.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class OrgchartAdminPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  departments: Department[] = [];
  roles: DepartmentRole[] = [];

  selectedSegment: 'departments' | 'roles' = 'departments';
  
  isLoading = false;

  constructor(
    private apiService: IntranetApiService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInitialData() {
    this.isLoading = true;

    // Load roles
    this.apiService.getDepartmentRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => {
          this.roles = roles;
        },
        error: (err) => console.error('Error loading roles:', err)
      });
    
    // Load Departments
    this.apiService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.departments = response.results;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading departments:', err);
          this.isLoading = false;
        }
      });
  }

  onSegmentChange(event: any) {
    this.selectedSegment = event.detail.value;
  }

  getRoleBadgeColor(hierarchyLevel: number): string {
    if (hierarchyLevel === 1) return 'danger';
    if (hierarchyLevel === 2) return 'warning';
    if (hierarchyLevel === 3) return 'primary';
    return 'success';
  }
}