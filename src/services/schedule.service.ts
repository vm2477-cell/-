import { Injectable } from '@angular/core';
import { ScheduleStop, Agency } from '../models/schedule.model';

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private readonly AGENCIES_KEY = 'logistics_agencies';
  private readonly TRAVEL_TIMES_KEY = 'logistics_travel_times';
  private readonly WORK_TIME_PER_BOX_KEY = 'logistics_work_time_per_box';

  private isLocalStorageAvailable(): boolean {
    // FIX: Ensure the function returns a boolean value. `window.localStorage` is an object, not a boolean.
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  // --- Date-based Schedule ---
  loadScheduleForDate(date: string): ScheduleStop[] {
    if (!this.isLocalStorageAvailable()) return [];
    const data = window.localStorage.getItem(`schedule_${date}`);
    return data ? JSON.parse(data) : [];
  }

  saveScheduleForDate(date: string, stops: ScheduleStop[]): void {
    if (!this.isLocalStorageAvailable()) return;
    window.localStorage.setItem(`schedule_${date}`, JSON.stringify(stops));
  }
  
  getSavedScheduleDates(): string[] {
    if (!this.isLocalStorageAvailable()) return [];
    const dates: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('schedule_')) {
        dates.push(key.replace('schedule_', ''));
      }
    }
    return dates.sort((a, b) => b.localeCompare(a)); // Sort descending, most recent first
  }

  // --- Settings ---
  loadAgencies(): Agency[] {
    if (!this.isLocalStorageAvailable()) return [];
    const data = window.localStorage.getItem(this.AGENCIES_KEY);
    return data ? JSON.parse(data) : [];
  }

  saveAgencies(agencies: Agency[]): void {
    if (!this.isLocalStorageAvailable()) return;
    window.localStorage.setItem(this.AGENCIES_KEY, JSON.stringify(agencies));
  }

  loadTravelTimes(): Record<string, number> {
    if (!this.isLocalStorageAvailable()) return {};
    const data = window.localStorage.getItem(this.TRAVEL_TIMES_KEY);
    return data ? JSON.parse(data) : {};
  }

  saveTravelTimes(times: Record<string, number>): void {
    if (!this.isLocalStorageAvailable()) return;
    window.localStorage.setItem(this.TRAVEL_TIMES_KEY, JSON.stringify(times));
  }

  loadWorkTimePerBox(): number {
    if (!this.isLocalStorageAvailable()) return 30; // Default 30 seconds
    const data = window.localStorage.getItem(this.WORK_TIME_PER_BOX_KEY);
    return data ? parseInt(data, 10) : 30;
  }

  saveWorkTimePerBox(seconds: number): void {
    if (!this.isLocalStorageAvailable()) return;
    window.localStorage.setItem(this.WORK_TIME_PER_BOX_KEY, seconds.toString());
  }
}