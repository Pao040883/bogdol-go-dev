import { Component, inject, signal, computed, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonSearchbar, IonList, IonItem, IonLabel, IonIcon, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  // Buttons
  closeOutline, checkmarkOutline,
  // Gesundheit & Medizin
  medkitOutline, bandageOutline, fitnessOutline, bodyOutline, pulseOutline, thermometerOutline,
  // Urlaub & Reisen
  airplaneOutline, carOutline, trainOutline, boatOutline, bicycleOutline, walkOutline,
  mapOutline, compassOutline, locationOutline, navigateOutline,
  // Arbeit & Büro
  homeOutline, briefcaseOutline, businessOutline, desktopOutline, laptopOutline,
  constructOutline, buildOutline, hammerOutline,
  // Zeit & Kalender
  timeOutline, timerOutline, stopwatchOutline, alarmOutline, calendarOutline,
  calendarNumberOutline, todayOutline,
  // Bildung & Lernen
  schoolOutline, bookOutline, libraryOutline, newspaperOutline, readerOutline, glassesOutline,
  // Personen & Familie
  peopleOutline, personOutline, manOutline, womanOutline, maleOutline, femaleOutline,
  heartOutline, giftOutline, balloonOutline, ribbonOutline,
  // Emotionen & Status
  happyOutline, sadOutline, checkmarkCircleOutline, closeCircleOutline, warningOutline,
  alertCircleOutline, informationCircleOutline, helpCircleOutline,
  // Kommunikation
  mailOutline, chatbubbleOutline, callOutline, videocamOutline, notificationsOutline,
  // Dokumente & Dateien
  documentOutline, documentTextOutline, clipboardOutline, folderOutline, archiveOutline, printOutline,
  // Sonstiges
  cafeOutline, restaurantOutline, beerOutline, wineOutline, pizzaOutline, fastFoodOutline,
  bedOutline, moonOutline, sunnyOutline, cloudOutline, rainyOutline, snowOutline,
  thunderstormOutline, umbrellaOutline, flashlightOutline, keyOutline, lockClosedOutline,
  shieldOutline, medalOutline, trophyOutline, starOutline, flameOutline,
  musicalNotesOutline, headsetOutline, cameraOutline, imageOutline, colorPaletteOutline
} from 'ionicons/icons';

interface IconOption {
  name: string;
  label: string;
  category: string;
}

@Component({
  selector: 'app-icon-picker-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonSearchbar, IonList, IonItem, IonIcon
  ],
  templateUrl: './icon-picker-modal.component.html',
  styleUrls: ['./icon-picker-modal.component.scss']
})
export class IconPickerModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);

  @Input() selectedIcon?: string;
  @Input() previewColor?: string;

  searchTerm = signal('');

  availableIcons: IconOption[] = [
    // Gesundheit & Medizin
    { name: 'medkit-outline', label: 'Krankheit / Medizin', category: 'Gesundheit' },
    { name: 'bandage-outline', label: 'Verband', category: 'Gesundheit' },
    { name: 'fitness-outline', label: 'Fitness', category: 'Gesundheit' },
    { name: 'body-outline', label: 'Körper / Arzt', category: 'Gesundheit' },
    { name: 'pulse-outline', label: 'Herzschlag', category: 'Gesundheit' },
    { name: 'thermometer-outline', label: 'Thermometer', category: 'Gesundheit' },
    
    // Urlaub & Reisen
    { name: 'airplane-outline', label: 'Flugzeug / Urlaub', category: 'Reisen' },
    { name: 'car-outline', label: 'Auto', category: 'Reisen' },
    { name: 'train-outline', label: 'Zug', category: 'Reisen' },
    { name: 'boat-outline', label: 'Boot', category: 'Reisen' },
    { name: 'bicycle-outline', label: 'Fahrrad', category: 'Reisen' },
    { name: 'walk-outline', label: 'Spaziergang', category: 'Reisen' },
    { name: 'map-outline', label: 'Karte', category: 'Reisen' },
    { name: 'compass-outline', label: 'Kompass', category: 'Reisen' },
    { name: 'location-outline', label: 'Ort', category: 'Reisen' },
    { name: 'navigate-outline', label: 'Navigation', category: 'Reisen' },
    
    // Arbeit & Büro
    { name: 'home-outline', label: 'Home / Homeoffice', category: 'Arbeit' },
    { name: 'briefcase-outline', label: 'Aktentasche / Geschäft', category: 'Arbeit' },
    { name: 'business-outline', label: 'Business', category: 'Arbeit' },
    { name: 'desktop-outline', label: 'Desktop', category: 'Arbeit' },
    { name: 'laptop-outline', label: 'Laptop', category: 'Arbeit' },
    { name: 'construct-outline', label: 'Werkzeuge', category: 'Arbeit' },
    { name: 'build-outline', label: 'Bauen', category: 'Arbeit' },
    { name: 'hammer-outline', label: 'Hammer', category: 'Arbeit' },
    
    // Zeit & Kalender
    { name: 'time-outline', label: 'Zeit / Uhr', category: 'Zeit' },
    { name: 'timer-outline', label: 'Timer', category: 'Zeit' },
    { name: 'stopwatch-outline', label: 'Stoppuhr', category: 'Zeit' },
    { name: 'alarm-outline', label: 'Wecker', category: 'Zeit' },
    { name: 'calendar-outline', label: 'Kalender', category: 'Zeit' },
    { name: 'calendar-number-outline', label: 'Kalender Nummer', category: 'Zeit' },
    { name: 'today-outline', label: 'Heute', category: 'Zeit' },
    
    // Bildung & Lernen
    { name: 'school-outline', label: 'Schule / Fortbildung', category: 'Bildung' },
    { name: 'book-outline', label: 'Buch', category: 'Bildung' },
    { name: 'library-outline', label: 'Bibliothek', category: 'Bildung' },
    { name: 'newspaper-outline', label: 'Zeitung', category: 'Bildung' },
    { name: 'reader-outline', label: 'Lesen', category: 'Bildung' },
    { name: 'glasses-outline', label: 'Brille', category: 'Bildung' },
    
    // Personen & Familie
    { name: 'people-outline', label: 'Menschen / Team', category: 'Menschen' },
    { name: 'person-outline', label: 'Person', category: 'Menschen' },
    { name: 'man-outline', label: 'Mann', category: 'Menschen' },
    { name: 'woman-outline', label: 'Frau', category: 'Menschen' },
    { name: 'male-outline', label: 'Männlich', category: 'Menschen' },
    { name: 'female-outline', label: 'Weiblich', category: 'Menschen' },
    { name: 'heart-outline', label: 'Herz / Elternzeit', category: 'Menschen' },
    { name: 'gift-outline', label: 'Geschenk', category: 'Menschen' },
    { name: 'balloon-outline', label: 'Ballon', category: 'Menschen' },
    { name: 'ribbon-outline', label: 'Schleife / Feiertag', category: 'Menschen' },
    
    // Emotionen & Status
    { name: 'happy-outline', label: 'Glücklich / Feier', category: 'Status' },
    { name: 'sad-outline', label: 'Traurig / Trauerfall', category: 'Status' },
    { name: 'checkmark-circle-outline', label: 'Bestätigt', category: 'Status' },
    { name: 'close-circle-outline', label: 'Abgelehnt', category: 'Status' },
    { name: 'warning-outline', label: 'Warnung', category: 'Status' },
    { name: 'alert-circle-outline', label: 'Alarm', category: 'Status' },
    { name: 'information-circle-outline', label: 'Information', category: 'Status' },
    { name: 'help-circle-outline', label: 'Hilfe', category: 'Status' },
    
    // Kommunikation
    { name: 'mail-outline', label: 'E-Mail', category: 'Kommunikation' },
    { name: 'chatbubble-outline', label: 'Chat', category: 'Kommunikation' },
    { name: 'call-outline', label: 'Telefon', category: 'Kommunikation' },
    { name: 'videocam-outline', label: 'Video', category: 'Kommunikation' },
    { name: 'notifications-outline', label: 'Benachrichtigung', category: 'Kommunikation' },
    
    // Dokumente & Dateien
    { name: 'document-outline', label: 'Dokument', category: 'Dokumente' },
    { name: 'document-text-outline', label: 'Dokument Text', category: 'Dokumente' },
    { name: 'clipboard-outline', label: 'Zwischenablage / Sabbatical', category: 'Dokumente' },
    { name: 'folder-outline', label: 'Ordner', category: 'Dokumente' },
    { name: 'archive-outline', label: 'Archiv', category: 'Dokumente' },
    { name: 'print-outline', label: 'Drucken', category: 'Dokumente' },
    
    // Sonstiges
    { name: 'cafe-outline', label: 'Kaffee / Pause', category: 'Sonstiges' },
    { name: 'restaurant-outline', label: 'Restaurant', category: 'Sonstiges' },
    { name: 'beer-outline', label: 'Bier', category: 'Sonstiges' },
    { name: 'wine-outline', label: 'Wein', category: 'Sonstiges' },
    { name: 'pizza-outline', label: 'Pizza', category: 'Sonstiges' },
    { name: 'fast-food-outline', label: 'Fast Food', category: 'Sonstiges' },
    { name: 'bed-outline', label: 'Bett / Schlaf', category: 'Sonstiges' },
    { name: 'moon-outline', label: 'Mond / Nacht', category: 'Sonstiges' },
    { name: 'sunny-outline', label: 'Sonne / Tag', category: 'Sonstiges' },
    { name: 'cloud-outline', label: 'Wolke / Wetter', category: 'Sonstiges' },
    { name: 'rainy-outline', label: 'Regen', category: 'Sonstiges' },
    { name: 'snow-outline', label: 'Schnee', category: 'Sonstiges' },
    { name: 'thunderstorm-outline', label: 'Gewitter', category: 'Sonstiges' },
    { name: 'umbrella-outline', label: 'Regenschirm', category: 'Sonstiges' },
    { name: 'flashlight-outline', label: 'Taschenlampe', category: 'Sonstiges' },
    { name: 'key-outline', label: 'Schlüssel', category: 'Sonstiges' },
    { name: 'lock-closed-outline', label: 'Schloss', category: 'Sonstiges' },
    { name: 'shield-outline', label: 'Schild', category: 'Sonstiges' },
    { name: 'medal-outline', label: 'Medaille', category: 'Sonstiges' },
    { name: 'trophy-outline', label: 'Trophäe', category: 'Sonstiges' },
    { name: 'star-outline', label: 'Stern', category: 'Sonstiges' },
    { name: 'flame-outline', label: 'Flamme', category: 'Sonstiges' },
    { name: 'musical-notes-outline', label: 'Musik', category: 'Sonstiges' },
    { name: 'headset-outline', label: 'Kopfhörer', category: 'Sonstiges' },
    { name: 'camera-outline', label: 'Kamera', category: 'Sonstiges' },
    { name: 'image-outline', label: 'Bild', category: 'Sonstiges' },
    { name: 'color-palette-outline', label: 'Farbpalette', category: 'Sonstiges' }
  ];

  filteredIcons = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.availableIcons;
    }
    return this.availableIcons.filter(icon =>
      icon.label.toLowerCase().includes(term) ||
      icon.name.toLowerCase().includes(term) ||
      icon.category.toLowerCase().includes(term)
    );
  });

  constructor() {
    addIcons({
      closeOutline, checkmarkOutline,
      medkitOutline, bandageOutline, fitnessOutline, bodyOutline, pulseOutline, thermometerOutline,
      airplaneOutline, carOutline, trainOutline, boatOutline, bicycleOutline, walkOutline,
      mapOutline, compassOutline, locationOutline, navigateOutline,
      homeOutline, briefcaseOutline, businessOutline, desktopOutline, laptopOutline,
      constructOutline, buildOutline, hammerOutline,
      timeOutline, timerOutline, stopwatchOutline, alarmOutline, calendarOutline,
      calendarNumberOutline, todayOutline,
      schoolOutline, bookOutline, libraryOutline, newspaperOutline, readerOutline, glassesOutline,
      peopleOutline, personOutline, manOutline, womanOutline, maleOutline, femaleOutline,
      heartOutline, giftOutline, balloonOutline, ribbonOutline,
      happyOutline, sadOutline, checkmarkCircleOutline, closeCircleOutline, warningOutline,
      alertCircleOutline, informationCircleOutline, helpCircleOutline,
      mailOutline, chatbubbleOutline, callOutline, videocamOutline, notificationsOutline,
      documentOutline, documentTextOutline, clipboardOutline, folderOutline, archiveOutline, printOutline,
      cafeOutline, restaurantOutline, beerOutline, wineOutline, pizzaOutline, fastFoodOutline,
      bedOutline, moonOutline, sunnyOutline, cloudOutline, rainyOutline, snowOutline,
      thunderstormOutline, umbrellaOutline, flashlightOutline, keyOutline, lockClosedOutline,
      shieldOutline, medalOutline, trophyOutline, starOutline, flameOutline,
      musicalNotesOutline, headsetOutline, cameraOutline, imageOutline, colorPaletteOutline
    });
  }

  ngOnInit() {
    if (this.selectedIcon) {
      // Optional: Scroll to selected icon
    }
  }

  selectIcon(icon: IconOption) {
    this.modalCtrl.dismiss(icon.name, 'selected');
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
