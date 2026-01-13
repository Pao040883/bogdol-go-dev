import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonSpinner,
  IonIcon,
  ModalController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, add, trash, person, business, calendar } from 'ionicons/icons';
import { FakturaAssignmentService, FakturaAssignment, FakturaEmployee } from './faktura-assignment.service';

@Component({
  selector: 'app-faktura-assignment-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,

    IonNote,
    IonSpinner,
    IonIcon
  ],
  templateUrl: './faktura-assignment-modal.component.html',
  styleUrls: ['./faktura-assignment-modal.component.scss']
})
export class FakturaAssignmentModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private fakturaService = inject(FakturaAssignmentService);

  fakturaEmployees = signal<FakturaEmployee[]>([]);
  myAssignments = signal<FakturaAssignment[]>([]);
  loading = signal(true);

  constructor() {
    addIcons({ close, add, trash, person, business, calendar });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      // Lade alle Faktura-Mitarbeiter (inkl. Zuweisungs-Info)
      const employees = await this.fakturaService.getFakturaEmployees();
      this.fakturaEmployees.set(employees);

      // Lade meine Faktura-Zuweisungen (wo ich faktura_processor bin)
      const assignments = await this.fakturaService.getMyAssignments();
      this.myAssignments.set(assignments);
    } catch (error) {
      console.error('Failed to load data:', error);
      await this.showToast('Fehler beim Laden der Daten', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Prüft ob Employee zugewiesen ist (egal von wem)
   */
  isAssigned(employeeId: number): boolean {
    const employee = this.fakturaEmployees().find(e => e.id === employeeId);
    return !!employee?.assignment;
  }

  /**
   * Prüft ob Employee MIR zugewiesen ist
   */
  isMyAssignment(employeeId: number): boolean {
    const employee = this.fakturaEmployees().find(e => e.id === employeeId);
    return employee?.assignment?.is_my_assignment ?? false;
  }

  /**
   * Prüft ob Checkbox disabled sein soll (fremde Zuweisung)
   */
  isCheckboxDisabled(employee: FakturaEmployee): boolean {
    // Disabled wenn zugewiesen ABER nicht von mir
    return !!employee.assignment && !employee.assignment.is_my_assignment;
  }

  getAssignment(employeeId: number): FakturaAssignment | undefined {
    return this.myAssignments().find(a => a.employee.id === employeeId && a.is_active);
  }

  async toggleAssignment(employee: FakturaEmployee, event: any) {
    const isChecked = event.detail.checked;

    if (isChecked) {
      // Zuweisen
      await this.assignEmployee(employee);
    } else {
      // Entfernen - nur wenn es meine Zuweisung ist
      if (employee.assignment?.is_my_assignment) {
        await this.removeAssignment(employee);
      }
    }
  }

  async assignEmployee(employee: FakturaEmployee) {
    try {
      const newAssignment = await this.fakturaService.createAssignment({
        employee_id: employee.id,
        department_id: employee.department?.id,
        valid_from: null,
        valid_until: null
      });

      // Zur Liste hinzufügen
      this.myAssignments.set([...this.myAssignments(), newAssignment]);
      
      // Employee-Objekt aktualisieren
      const updatedEmployees = this.fakturaEmployees().map(e => {
        if (e.id === employee.id) {
          return {
            ...e,
            assignment: {
              assignment_id: newAssignment.id,
              faktura_processor_id: newAssignment.faktura_processor,
              faktura_processor_name: 'Sie',
              is_my_assignment: true,
              created_at: newAssignment.created_at
            }
          };
        }
        return e;
      });
      this.fakturaEmployees.set(updatedEmployees);
      
      await this.showToast(`${employee.name} wurde zugewiesen`, 'success');
    } catch (error) {
      console.error('Failed to assign:', error);
      await this.showToast('Fehler beim Zuweisen', 'danger');
    }
  }

  async removeAssignment(employee: FakturaEmployee) {
    if (!employee.assignment) return;

    const alert = await this.alertCtrl.create({
      header: 'Zuweisung entfernen',
      message: `Möchten Sie die Zuweisung von ${employee.name} wirklich entfernen?`,
      buttons: [
        {
          text: 'Abbrechen',
          role: 'cancel'
        },
        {
          text: 'Entfernen',
          role: 'destructive',
          handler: async () => {
            try {
              await this.fakturaService.deleteAssignment(employee.assignment!.assignment_id);
              
              // Aus Liste entfernen
              this.myAssignments.set(
                this.myAssignments().filter(a => a.id !== employee.assignment!.assignment_id)
              );
              
              // Employee-Objekt aktualisieren (assignment entfernen)
              const updatedEmployees = this.fakturaEmployees().map(e => {
                if (e.id === employee.id) {
                  const { assignment, ...rest } = e;
                  return rest;
                }
                return e;
              });
              this.fakturaEmployees.set(updatedEmployees);
              
              await this.showToast('Zuweisung wurde entfernt', 'success');
            } catch (error) {
              console.error('Failed to delete:', error);
              await this.showToast('Fehler beim Entfernen', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color
    });
    await toast.present();
  }

  close() {
    this.modalCtrl.dismiss();
  }
}
