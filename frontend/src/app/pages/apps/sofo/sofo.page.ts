import {
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonListHeader,
  IonLabel,
  IonIcon,
  IonTabButton,
  IonTabBar,
  IonTab,
  IonTabs,
  IonButton,
  IonInput,
  IonCheckbox,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSearchbar,
  IonAvatar,
  IonImg,
  IonItemDivider,
  IonNote,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  library,
  playCircle,
  radio,
  search,
  list,
  add,
  checkmarkCircle,
  closeCircle,
  archive, people } from 'ionicons/icons';
import { Countries } from './countries';
import { Sofortmeldung } from 'src/app/core/interfaces/sofortmeldung';
import { SofortmeldungService } from 'src/app/core/services/sofortmeldung.service';
import { Router } from '@angular/router';
import { HRAssignmentModalComponent } from 'src/app/components/hr-assignment-modal/hr-assignment-modal.component';

@Component({
  selector: 'app-sofo',
  templateUrl: './sofo.page.html',
  styleUrls: ['./sofo.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonNote,
    IonItemDivider,
    IonSearchbar,
    IonModal,
    IonDatetimeButton,
    IonDatetime,
    IonCheckbox,
    IonInput,
    IonButton,
    IonTabs,
    IonTab,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonListHeader,
    IonItem,
    IonList,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonSelect,
    IonSelectOption,
  ],
})
export class SofoPage implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private service = inject(SofortmeldungService);
  private modalController = inject(ModalController);

  form: FormGroup = this.fb.group({
    insurance_number: ['', Validators.required],
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    citizenship: [''],
    start_date: [new Date().toISOString(), Validators.required],
    group: ['', Validators.required],
    birth_land: [''],
    birth_gender: [''],
    birth_name: [''],
    birth_date: [new Date('1990-01-01').toISOString()],
    birth_place: [''],
    street_name: [''],
    zip_code: ['', [Validators.pattern(/^\d{5}$/)]],
    city_name: [''],
  });

  svNumberAvailable = signal(true);

  currentMonthYear: string;
  countries = Countries;
  results = [...this.countries];
  birthland = [...this.countries];
  readonly sofortmeldungenAktuellerMonat = computed(() =>
    this.service
      .sofortmeldungen$()
      .filter((m: Sofortmeldung) => this.isSameMonth(m.start_date))
  );
  readonly sofortmeldungenArichiv = computed(() =>
    this.service
      .sofortmeldungen$()
      .filter((m: Sofortmeldung) => !this.isSameMonth(m.start_date))
  );

  @ViewChild('dateModal', { static: false }) dateModal?: IonModal;
  @ViewChild('dateModal2', { static: false }) dateModal2?: IonModal;
  @ViewChild('modal', { static: false }) modal?: IonModal;
  @ViewChild('modalBirthland', { static: false }) modalBirthCountry?: IonModal;
@ViewChild('tabs', { static: true }) tabs!: IonTabs;

  constructor() {
    addIcons({people,list,add,archive,checkmarkCircle,closeCircle,library,search,radio,playCircle,});

    const now = new Date();
    const month = now.toLocaleString('de-DE', { month: 'long' });
    const year = now.getFullYear();
    this.currentMonthYear = `${month} ${year}`;
  }

  async openHRAssignmentModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: HRAssignmentModalComponent,
      cssClass: 'hr-assignment-modal'
    });
    await modal.present();
  }

  isSameMonth(dateStr?: string): boolean {
    if (!dateStr) return false;

    const date = new Date(dateStr);
    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  ngOnInit() {
    this.service.fetchAll();
  }

  toggleSv() {
    const current = this.svNumberAvailable();
    this.svNumberAvailable.set(!current);

    const control = this.form.get('svNumber');
    if (!current) {
      control?.addValidators([Validators.required]);
      control?.addValidators([Validators.required]);
      control?.updateValueAndValidity();

      // restliche Felder entfernen
      this.form.get('citizenship')?.clearValidators();
      this.form.get('birth_land')?.clearValidators();
      this.form.get('birth_gender')?.clearValidators();
      this.form.get('birth_name')?.clearValidators();
      this.form.get('birth_date')?.clearValidators();
      this.form.get('birth_place')?.clearValidators();
      this.form.get('street_name')?.clearValidators();
      this.form.get('zip_code')?.clearValidators();
      this.form.get('city_name')?.clearValidators();
    } else {
      control?.clearValidators();
      control?.reset();
      control?.updateValueAndValidity();

      // alle übrigen Pflichtfelder aktivieren
      this.form.get('citizenship')?.setValidators([Validators.required]);
      this.form.get('birth_land')?.setValidators([Validators.required]);
      this.form.get('birth_gender')?.setValidators([Validators.required]);
      this.form.get('birth_name')?.setValidators([Validators.required]);
      this.form.get('birth_date')?.setValidators([Validators.required]);
      this.form.get('birth_place')?.setValidators([Validators.required]);
      this.form.get('street_name')?.setValidators([Validators.required]);
      this.form
        .get('zip_code')
        ?.setValidators([Validators.required, Validators.pattern(/^\d{5}$/)]);
      this.form.get('city_name')?.setValidators([Validators.required]);
    }

    // alle geänderten Felder aktualisieren
    [
      'citizenship',
      'birth_land',
      'birth_gender',
      'birth_name',
      'birth_date',
      'birth_place',
      'street_name',
      'zip_code',
      'city_name',
    ].forEach((name) => {
      this.form.get(name)?.updateValueAndValidity();
    });
  }

  closeDateModal() {
    this.dateModal?.dismiss();
  }

  closeDateModal2() {
    this.dateModal2?.dismiss();
  }

  closeModal() {
    this.modal?.dismiss();
    this.results = [...this.countries];
  }

  closeBirthCountryModal() {
    this.modalBirthCountry?.dismiss();
    this.results = [...this.countries];
  }

  handleInput(event: Event) {
    const target = event.target as HTMLIonSearchbarElement;
    const query = target.value?.toLowerCase() || '';
    this.results = this.countries.filter((d) =>
      d.title.toLowerCase().includes(query)
    );
  }

  handleInputBirthland(event: Event) {
    const target = event.target as HTMLIonSearchbarElement;
    const query = target.value?.toLowerCase() || '';
    this.birthland = this.countries.filter((d) =>
      d.title.toLowerCase().includes(query)
    );
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = { ...this.form.value };

    // Konvertierung des Datumsformats (nur Datumsteil)
    if (formValue.birth_date) {
      if (!this.svNumberAvailable()) {
        const date = new Date(formValue.birth_date);
        formValue.birth_date = date.toISOString().split('T')[0];
      } else {
        formValue.birth_date = null;
      }

      const start_date = new Date(formValue.start_date);
      formValue.start_date = start_date.toISOString().split('T')[0];
    }

    this.service.create(formValue);
    this.form.reset();            // optional: Formular leeren
    this.tabs.select('home'); // <<< Tab umschalten
  }

  selectCountry(country: { title: string; value: string }) {
    this.form.get('citizenship')?.setValue(country.title);
    this.closeModal();
  }

  selectbirthCountry(country: { title: string; value: string }) {
    this.form.get('birth_land')?.setValue(country.title);
    this.closeBirthCountryModal();
  }
}
