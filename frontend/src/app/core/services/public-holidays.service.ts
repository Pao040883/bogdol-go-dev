import { Injectable } from '@angular/core';

export interface PublicHoliday {
  date: Date;
  name: string;
  isNationwide: boolean;
}

/**
 * Service für deutsche Feiertage (Hamburg)
 * Berechnet gesetzliche Feiertage für Deutschland mit Fokus auf Hamburg
 */
@Injectable({
  providedIn: 'root'
})
export class PublicHolidaysService {
  
  /**
   * Gibt alle Feiertage für ein Jahr zurück (Hamburg)
   */
  getHolidaysForYear(year: number): PublicHoliday[] {
    const holidays: PublicHoliday[] = [];
    
    // Feste Feiertage (bundesweit)
    holidays.push({ date: new Date(year, 0, 1), name: 'Neujahr', isNationwide: true });
    holidays.push({ date: new Date(year, 4, 1), name: 'Tag der Arbeit', isNationwide: true });
    holidays.push({ date: new Date(year, 9, 3), name: 'Tag der Deutschen Einheit', isNationwide: true });
    holidays.push({ date: new Date(year, 9, 31), name: 'Reformationstag', isNationwide: false }); // Hamburg seit 2018
    holidays.push({ date: new Date(year, 11, 25), name: '1. Weihnachtstag', isNationwide: true });
    holidays.push({ date: new Date(year, 11, 26), name: '2. Weihnachtstag', isNationwide: true });
    
    // Bewegliche Feiertage (basierend auf Ostern)
    const easter = this.calculateEaster(year);
    
    // Karfreitag (Freitag vor Ostern)
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    holidays.push({ date: goodFriday, name: 'Karfreitag', isNationwide: true });
    
    // Ostermontag
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays.push({ date: easterMonday, name: 'Ostermontag', isNationwide: true });
    
    // Christi Himmelfahrt (39 Tage nach Ostern)
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    holidays.push({ date: ascension, name: 'Christi Himmelfahrt', isNationwide: true });
    
    // Pfingstmontag (50 Tage nach Ostern)
    const whitMonday = new Date(easter);
    whitMonday.setDate(easter.getDate() + 50);
    holidays.push({ date: whitMonday, name: 'Pfingstmontag', isNationwide: true });
    
    return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  
  /**
   * Prüft, ob ein Datum ein Feiertag ist
   */
  isPublicHoliday(date: Date): boolean {
    const year = date.getFullYear();
    const holidays = this.getHolidaysForYear(year);
    
    return holidays.some(holiday => this.isSameDay(holiday.date, date));
  }
  
  /**
   * Gibt den Namen des Feiertags zurück, wenn das Datum ein Feiertag ist
   */
  getHolidayName(date: Date): string | null {
    const year = date.getFullYear();
    const holidays = this.getHolidaysForYear(year);
    
    const holiday = holidays.find(h => this.isSameDay(h.date, date));
    return holiday ? holiday.name : null;
  }
  
  /**
   * Zählt Arbeitstage zwischen zwei Daten (ohne Wochenenden und Feiertage)
   */
  countWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = this.isPublicHoliday(current);
      
      if (!isWeekend && !isHoliday) {
        count++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }
  
  /**
   * Gibt alle Feiertage in einem Datumsbereich zurück
   */
  getHolidaysInRange(startDate: Date, endDate: Date): PublicHoliday[] {
    const holidays: PublicHoliday[] = [];
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    // Hole Feiertage für alle Jahre im Bereich
    for (let year = startYear; year <= endYear; year++) {
      const yearHolidays = this.getHolidaysForYear(year);
      holidays.push(...yearHolidays.filter(h => 
        h.date >= startDate && h.date <= endDate
      ));
    }
    
    return holidays;
  }
  
  /**
   * Berechnet Ostersonntag nach Gauß'scher Osterformel
   */
  private calculateEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // JavaScript months are 0-based
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month, day);
  }
  
  /**
   * Prüft, ob zwei Daten der gleiche Tag sind
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}
