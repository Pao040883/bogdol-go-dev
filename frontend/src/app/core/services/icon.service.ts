import { Injectable } from '@angular/core';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  appsOutline,
  paperPlaneOutline,
  statsChartOutline,
  settingsOutline,
  logOutOutline,
  personOutline,
  bookOutline,
  checkboxOutline,
  personAddOutline,
  timeOutline,
  documentOutline,
  chevronDownOutline,
  chevronUpOutline,
  addOutline,
  createOutline,
  trashOutline,
  searchOutline,
  refreshOutline,
  saveOutline,
  closeOutline,
  checkmarkOutline,
  alertOutline,
  informationOutline,
  warningOutline,
  eyeOutline,
  eyeOffOutline,
  menuOutline,
  notificationsOutline,
  chatbubblesOutline
} from 'ionicons/icons';

@Injectable({ providedIn: 'root' })
export class IconService {
  
  constructor() {
    this.registerIcons();
  }

  /**
   * Registriert alle Icons zentral
   * Wird automatisch beim Service-Init aufgerufen
   */
  private registerIcons(): void {
    addIcons({
      // Navigation
      homeOutline,
      appsOutline,
      paperPlaneOutline,
      statsChartOutline,
      settingsOutline,
      logOutOutline,
      menuOutline,
      chatbubblesOutline,

      // User Management
      personOutline,
      personAddOutline,
      
      // Content
      bookOutline,
      documentOutline,
      timeOutline,
      checkboxOutline,
      
      // Actions
      addOutline,
      createOutline,
      trashOutline,
      searchOutline,
      refreshOutline,
      saveOutline,
      closeOutline,
      checkmarkOutline,
      
      // UI Elements
      chevronDownOutline,
      chevronUpOutline,
      eyeOutline,
      eyeOffOutline,
      
      // Status
      alertOutline,
      informationOutline,
      warningOutline,
      notificationsOutline
    });
  }

  /**
   * Fügt zusätzliche Icons hinzu (falls dynamisch benötigt)
   * @param icons Object mit Icon-Namen und Icon-Definitionen
   */
  addIcons(icons: { [key: string]: string }): void {
    addIcons(icons);
  }
}
