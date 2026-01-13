import { Component, inject, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatAccordion, MatExpansionModule, MatExpansionPanel } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { SortAndFilterPipe } from './sort-and-filter.pipe';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { UsersService } from './../../../core/services/users.service';
import { IonHeader, IonToolbar, IonTitle, IonContent } from "@ionic/angular/standalone";
import { AuthService } from 'src/app/core/services/auth.service';

interface ServiceManager {
  id: number;
  firstName: string;
  lastName: string;
  locations: {
    id: number;
    name: string;
    objectNumber: string;
    worklogs: {
      status: string;
    }[];
    areas: {
      name: string; // Kleinbuchstaben
    }[];
  }[];
}


@Component({
  selector: 'app-blink-usage',
  standalone: true,
  imports: [IonContent, IonTitle, IonToolbar, IonHeader, 
    CommonModule,
    MatAccordion,
    MatTableModule,
    MatButtonModule,
    FormsModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatExpansionPanel,
    MatExpansionModule,
    SortAndFilterPipe,
    MatInputModule,
    MatCardModule,
    MatButtonToggleModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './blink-usage.page.html',
  styleUrls: ['./blink-usage.page.scss']
})

export class BlinkTestComponent implements OnInit {
  private authUrl = 'https://bogdol-api.blink.online/api/v2/auth';
  private authToken: string | null = null;
  private userService = inject(UsersService);
  private authService = inject(AuthService);
  activeUser = this.authService.activeUser();
  loggedUser = this.userService.loggedUser;
  startDate = '';
  endDate = '';
  uniqueAreas: string[] = [];

  serviceManagers: ServiceManager[] = []; // Variable zum Speichern der Daten
  filteredServiceManagers: ServiceManager[] = []; // Gefilterte Daten
  filterText: string = ''; // Eingabetext für den Filter
  loading: boolean = false; // Zustand für das Laden

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.authenticate('p.offermanns@bogdol-dienstleistungen.de', 'Joni#3487'); // Ersetze mit gültigen Zugangsdaten
  }

  // Authentifizierungsmethode
  authenticate(username: string, password: string): void {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    const body = {
      AuthMode: 'Pwd',
      Username: username,
      Password: password,
      Device: {
        Number: 'bogdol',
        Type: 'AzureFunction',
        DeviceInfo: 'bogdol',
      },
    };

    this.http.post<{ id_token: string }>(this.authUrl, body, { headers }).subscribe({
      next: (response) => {
        this.authToken = response.id_token;
      },
      error: (error) => console.error('Authentifizierung fehlgeschlagen:', error),
    });
  }

  // Methode zum Starten der Datenabfrage
  onLoadDataClick(): void {
    if (!this.authToken) {
      console.error('Kein Authentifizierungstoken verfügbar. Bitte zuerst einloggen.');
      return;
    }

    this.loading = true;

    forkJoin({
      serviceManagers: this.fetchAllServiceManagers(),
      locations: this.fetchAllLocations(),
      worklogs: this.fetchAllWorklogs(),
    }).subscribe({
      next: ({ serviceManagers, locations, worklogs }) => {
        this.serviceManagers = this.aggregateData(serviceManagers, locations, worklogs);
        this.applyFilter(); // Wende den Filter an
        this.getUniqueAreas(); // Aktualisiere die Liste der Areas
      },
      error: (error) => {
        console.error('Fehler beim Laden der Daten:', error);
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  applyFilter(): void {
    const filter = this.filterText.toLowerCase();

    this.filteredServiceManagers = this.serviceManagers.filter((manager) => {
      const fullName = `${manager.firstName} ${manager.lastName}`.toLowerCase();

      // Sammle alle Areas aus den Locations des Managers
      const areaNames = manager.locations
        .flatMap((location) => location.areas.map((area) => area.name.toLowerCase()))
        .join(' ');

      return fullName.includes(filter) || areaNames.includes(filter);
    });
  }

  // Methode, um alle eindeutigen Areas zu sammeln
  getUniqueAreas(): void {
    const allAreas = this.serviceManagers
      .flatMap((manager) => manager.locations.flatMap((location) => location.areas.map((area) => area.name)));

    this.uniqueAreas = [...new Set(allAreas)].sort(); // Entfernt Duplikate
  }

  filterByArea(area: string): void {
    this.filteredServiceManagers = this.serviceManagers.filter((manager) =>
      manager.locations.some((location) =>
        location.areas.some((a) => a.name === area)
      )
    );
  }

  resetFilter(): void {
    this.filteredServiceManagers = [...this.serviceManagers]; // Originaldaten wiederherstellen
    this.filterText = ''; // Suchtext zurücksetzen (falls relevant)
  }


  // Schritt 1: Service Manager laden
  fetchAllServiceManagers(): Observable<{ id: number; firstName: string; lastName: string }[]> {
    const headers = this.createAuthHeaders();
    let url = '';

    if (this.loggedUser()?.role === 'Servicemanager') {
      const blinkId = this.loggedUser()?.blink.id.toString();
      url =
        `https://bogdol-api.blink.online/odata/v2/CompanyPermissionGroups?$expand=LoginUsers(%24select%3DId%2CFirstName%2CLastName%3B%24filter%3DActive%20eq%20true%20and%20Id%20eq%20${blinkId})&$filter=CompanyId%20eq%20${this.loggedUser()?.blink.company}%20and%20Id%20eq%207&$select=Name`;
    
      } else {
      if (this.loggedUser()?.blink.company == 1) {
url =
        `https://bogdol-api.blink.online/odata/v2/CompanyPermissionGroups?$expand=LoginUsers(%24select%3DId%2CFirstName%2CLastName%3B%24filter%3DActive%20eq%20true%20)&$filter=CompanyId%20eq%20${this.loggedUser()?.blink.company}%20and%20Id%20eq%207&$select=Name`;
      } else if(this.loggedUser()?.blink.company == 7) {
        url =
        `https://bogdol-api.blink.online/odata/v2/CompanyPermissionGroups?$expand=LoginUsers(%24select%3DId%2CFirstName%2CLastName%3B%24filter%3DActive%20eq%20true%20)&$filter=CompanyId%20eq%20${this.loggedUser()?.blink.company}%20and%20Id%20eq%2032&$select=Name`;
      }
      

    }

    return this.http.get<{ value: { LoginUsers: { Id: number; FirstName: string; LastName: string }[] }[] }>(url, { headers }).pipe(
      map((response) => {
        const loginUsers = response.value[0]?.LoginUsers || [];
        return loginUsers.map((user) => ({
          id: user.Id,
          firstName: user.FirstName,
          lastName: user.LastName,
        }));
      })
    );
  }

  fetchAllLocations(): Observable<{ id: number; name: string; objectNumber: string; userId: number; areas: { name: string }[] }[]> {
    const headers = this.createAuthHeaders();

    const url =
      'https://bogdol-api.blink.online/odata/v2/Employees?$expand=ManagedLocations(%24select%3DId%2CName%2CObjectNumber%3B%24filter%3DIsActive%20eq%20true),Areas(%24select%3DName)&$select=LoginUserId';

    return this.http.get<{ value: { LoginUserId: number; ManagedLocations: { Id: number; Name: string; ObjectNumber: string }[]; Areas: { Name: string }[] }[] }>(url, { headers }).pipe(
      map((response) => {
        const locations = [];
        for (const employee of response.value) {
          const userId = employee.LoginUserId;
          const managedLocations = employee.ManagedLocations || [];
          const areas = (employee.Areas || []).map((area) => ({
            name: area.Name, // Mappe 'Name' auf 'name'
          }));
          for (const loc of managedLocations) {
            locations.push({
              id: loc.Id,
              name: loc.Name,
              objectNumber: loc.ObjectNumber,
              userId,
              areas, // Bereiche korrekt zugeordnet
            });
          }
        }
        return locations;
      })
    );
  }



  // Schritt 3: Worklogs laden
  fetchAllWorklogs(): Observable<{ locationId: number; status: string }[]> {
    const headers = this.createAuthHeaders();

    const url =
      `https://bogdol-api.blink.online/odata/v3/Worklogs?$filter=Date%20ge%20${this.formatDate(this.startDate)}%20and%20Date%20le%20${this.formatDate(this.endDate)}&$select=LocationId,Status`;

    return this.http.get<{ value: { LocationId: number; Status: string }[] }>(url, { headers }).pipe(
      map((response) => {
        return response.value.map((worklog) => ({
          locationId: worklog.LocationId,
          status: worklog.Status,
        }));
      })
    );
  }

  aggregateData(
    serviceManagers: { id: number; firstName: string; lastName: string }[],
    locations: { id: number; name: string; objectNumber: string; userId: number; areas: { name: string }[] }[],
    worklogs: { locationId: number; status: string }[]
  ): ServiceManager[] {
    return serviceManagers.map((manager) => {
      const managerLocations = locations
        .filter((loc) => loc.userId === manager.id)
        .map((loc) => {
          const locationWorklogs = worklogs.filter((wl) => wl.locationId === loc.id);

          const statuses = locationWorklogs.reduce((acc, wl) => {
            acc[wl.status] = (acc[wl.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return {
            id: loc.id,
            name: loc.name,
            objectNumber: loc.objectNumber,
            worklogs: locationWorklogs,
            statuses, // Status zusammengefasst
            areas: loc.areas, // Bereichsdaten hinzufügen
          };
        });

      return {
        id: manager.id,
        firstName: manager.firstName,
        lastName: manager.lastName,
        locations: managerLocations,
        areas: managerLocations.flatMap((loc) => loc.areas), // Füge alle Areas des Managers hinzu
      };
    });
  }


  // Hilfsmethode für Header mit Authentifizierung
  private createAuthHeaders(): HttpHeaders {
    if (!this.authToken) {
      throw new Error('Kein Authentifizierungstoken verfügbar.');
    }

    return new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json;odata.metadata=minimal;odata.streaming=true',
      Authorization: `Bearer ${this.authToken}`,
    });
  }

  /**
 * Formatiert ein Datum in das benötigte Format.
 */
  formatDate = (date: string): string => {
    const convertedDate = new Date(date);
    const year = convertedDate.getFullYear();
    const month = String(convertedDate.getMonth() + 1).padStart(2, '0');
    const day = String(convertedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  isLocationFullyExported(location: { worklogs: { status: string }[] }): boolean {
    if (!location.worklogs || location.worklogs.length === 0) {
      return false; // Keine Worklogs vorhanden, nicht vollständig exportiert
    }

    // Liste der gültigen Statuswerte
    const validStatuses = ['Exported', 'Approved', 'Billed'];

    // Prüfen, ob alle Worklogs in der Location einen der gültigen Statuswerte haben
    return location.worklogs.every((worklog) => validStatuses.includes(worklog.status));
  }


  countFullyExportedLocations(serviceManagerId: number): number {
    const serviceManager = this.serviceManagers.find((sm) => sm.id === serviceManagerId);
    if (!serviceManager) return 0;

    // Zähle die Locations, bei denen alle Worklogs den Status `Exported` haben
    return serviceManager.locations.filter((location) => this.isLocationFullyExported(location)).length;
  }

  getExportPercentageForLocations(serviceManager: ServiceManager): number {
    const totalLocations = serviceManager.locations.length;
    const fullyExportedLocations = this.countFullyExportedLocations(serviceManager.id);

    return totalLocations > 0 ? (fullyExportedLocations / totalLocations) * 100 : 0;
  }

  translateStatus(status: string): string {
    const translations: { [key: string]: string } = {
      Exported: 'Exportiert',
      New: 'Neu',
      Approved: 'Freigegeben',
      Billed: 'Gebucht',
      // Weitere Übersetzungen hinzufügen
    };

    return translations[status] || status; // Fallback für nicht übersetzte Statusmeldungen
  }


  getTranslatedStatuses(location: { worklogs: { status: string }[] }): string[] {
    return location.worklogs.map((worklog) => this.translateStatus(worklog.status));
  }

  getStatusCounts(worklogs: { status: string }[]): { key: string; count: number }[] {
    if (!worklogs || worklogs.length === 0) {
      return [];
    }

    const statusCounts: { [key: string]: number } = {};

    // Status zählen
    worklogs.forEach((log) => {
      if (statusCounts[log.status]) {
        statusCounts[log.status]++;
      } else {
        statusCounts[log.status] = 1;
      }
    });

    // Umwandeln in ein Array mit { key, count }
    return Object.entries(statusCounts).map(([key, count]) => ({ key, count }));
  }

  sortField: string = 'lastName'; // Standard-Sortierfeld
  sortDirection: 'asc' | 'desc' = 'asc'; // Standard-Sortierreihenfolge
  filter: string = ''; // Suchtext für die Filterung

  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  setSortField(field: string): void {
    this.sortField = field;
    this.sortDirection = 'asc'; // Standardmäßig aufsteigend
  }
}