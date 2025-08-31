import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScheduleStop, Agency } from '../../models/schedule.model';
import { ScheduleService } from '../../services/schedule.service';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class ScheduleComponent implements OnInit {
  private scheduleService = inject(ScheduleService);

  // --- State Signals ---
  selectedDate = signal(new Date().toISOString().split('T')[0]);
  initialDepartureTime = signal('07:30');
  driverName = signal('임영진');
  additionalMessage = signal('');
  scheduleStops = signal<ScheduleStop[]>([]);
  lastSaved = signal<string | null>(null);
  viewMode = signal<'schedule' | 'history'>('schedule');
  savedScheduleDates = signal<string[]>([]);

  // --- Settings State ---
  agencies = signal<Agency[]>([]);
  travelTimes = signal<Record<string, number>>({}); // Key: 'fromId-toId' -> minutes
  workTimePerBox = signal(30); // in seconds
  activeTab = signal<'agencies' | 'travelTime' | 'workTime'>('agencies');
  
  // --- UI State for Forms ---
  newAgency: Agency = this.resetNewAgency();
  
  departureTimeOptions: string[] = [];

  constructor() {
    this.generateDepartureTimeOptions();

    // Effect for auto-saving settings
    effect(() => this.scheduleService.saveAgencies(this.agencies()));
    effect(() => this.scheduleService.saveTravelTimes(this.travelTimes()));
    effect(() => this.scheduleService.saveWorkTimePerBox(this.workTimePerBox()));
    
    // Effect for recalculating the entire schedule
    effect(() => {
        this.recalculateFullSchedule();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.loadAllData();
    this.loadHistory();
  }

  private generateDepartureTimeOptions(): void {
    const options: string[] = [];
    for (let h = 5; h <= 17; h++) {
      for (let m = 0; m < 60; m += 10) {
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        if (h === 17 && m > 0) continue;
        options.push(time);
      }
    }
    this.departureTimeOptions = options;
  }
  
  loadAllData(): void {
    // Load settings first
    this.agencies.set(this.scheduleService.loadAgencies());
    this.travelTimes.set(this.scheduleService.loadTravelTimes());
    this.workTimePerBox.set(this.scheduleService.loadWorkTimePerBox());
    
    // Load schedule for the selected date
    this.scheduleStops.set(this.scheduleService.loadScheduleForDate(this.selectedDate()));
  }

  loadHistory(): void {
    this.savedScheduleDates.set(this.scheduleService.getSavedScheduleDates());
  }

  loadPastSchedule(date: string): void {
    this.selectedDate.set(date);
    this.scheduleStops.set(this.scheduleService.loadScheduleForDate(date));
    this.viewMode.set('schedule');
  }

  onDateChange(event: Event): void {
    const newDate = (event.target as HTMLInputElement).value;
    this.selectedDate.set(newDate);
    this.scheduleStops.set(this.scheduleService.loadScheduleForDate(newDate));
    this.lastSaved.set(null); // Reset last saved time on date change
  }

  // --- Computed Signals ---
  totalTravelTime = computed(() => this.minutesToTime(this.scheduleStops().reduce((acc, stop) => acc + this.timeToMinutes(stop.travelTime), 0)));
  totalWorkTime = computed(() => this.minutesToTime(this.scheduleStops().reduce((acc, stop) => acc + this.timeToMinutes(stop.workTime), 0)));
  totalBoxes = computed(() => this.scheduleStops().reduce((acc, stop) => acc + (stop.boxes || 0), 0));

  messageText = computed(() => {
    const stops = this.scheduleStops();
    const agencyData = this.agencies();
    let message = `안녕하세요. ${this.driverName()} 입니다.\n${this.initialDepartureTime()}에 아산공장에서 출발합니다.\n\n`;
    stops.forEach(stop => {
      const agency = agencyData.find(a => a.id === stop.agencyId);
      if(agency) {
        message += `${agency.name}: ${stop.arrivalTime}\n`;
      }
    });

    const additionalMsg = this.additionalMessage().trim();
    if (additionalMsg) {
      message += `\n${additionalMsg}`;
    }

    return message;
  });

  // --- Schedule Management ---
  addStop(): void {
    this.scheduleStops.update(stops => [
      ...stops,
      { id: Date.now(), agencyId: null, travelTime: '00:00', workTime: '00:00', arrivalTime: '', departureTime: '', boxes: null }
    ]);
  }

  removeStop(idToRemove: number): void {
    this.scheduleStops.update(stops => stops.filter(stop => stop.id !== idToRemove));
  }
  
  saveSchedule(): void {
    this.scheduleService.saveScheduleForDate(this.selectedDate(), this.scheduleStops());
    this.lastSaved.set(new Date().toLocaleTimeString('ko-KR'));
  }
  
  updateStopProperty(id: number, property: keyof ScheduleStop, value: any): void {
    this.scheduleStops.update(stops => {
      return stops.map(stop => {
        if (stop.id === id) {
          const newStop = { ...stop, [property]: value };
          if (property === 'boxes') {
            newStop.boxes = value !== null && value !== '' ? +value : null;
          } else if (property === 'agencyId') {
            newStop.agencyId = value ? +value : null;
          }
          return newStop;
        }
        return stop;
      });
    });
  }

  copyMessage(): void {
      navigator.clipboard.writeText(this.messageText());
  }

  sendSms(): void {
    const stops = this.scheduleStops();
    const allAgencies = this.agencies();
    const message = this.messageText();

    const scheduledAgencyIds = [...new Set(stops.map(stop => stop.agencyId).filter(id => id !== null))];

    if (scheduledAgencyIds.length === 0) {
      alert('스케줄에 등록된 대리점이 없습니다.');
      return;
    }

    const phoneNumbers = scheduledAgencyIds.map(id => {
      const agency = allAgencies.find(a => a.id === id);
      return agency?.phone ? agency.phone.replace(/[\s-]/g, '') : null;
    }).filter((phone): phone is string => !!phone && phone.length > 0);

    if (phoneNumbers.length === 0) {
      alert('문자를 보낼 대리점의 전화번호가 등록되어 있지 않습니다. 설정 > 대리점 등록에서 전화번호를 추가해주세요.');
      return;
    }

    const recipients = phoneNumbers.join(',');
    const encodedMessage = encodeURIComponent(message);
    const smsUri = `sms:${recipients}?body=${encodedMessage}`;

    window.location.href = smsUri;
  }

  recalculateFullSchedule(): void {
    const stops = this.scheduleStops();
    const travelTimes = this.travelTimes();
    const workTimePerBox = this.workTimePerBox();
    
    let lastDepartureInMinutes = this.timeToMinutes(this.initialDepartureTime());
    let previousAgencyId: number | null = 0; // 0 is the fixed depot '아산 연세유업'

    const updatedStops = stops.map(stop => {
      // Find travel time
      const travelTimeKey = `${previousAgencyId}-${stop.agencyId}`;
      const travelInMinutes = travelTimes[travelTimeKey] || 0;
      const travelTimeStr = this.minutesToTime(travelInMinutes);
      
      // Calculate work time
      const workInSeconds = (stop.boxes || 0) * workTimePerBox;
      const workInMinutes = Math.round(workInSeconds / 60);
      const workTimeStr = this.minutesToTime(workInMinutes);

      const arrivalInMinutes = lastDepartureInMinutes + travelInMinutes;
      const departureInMinutes = arrivalInMinutes + workInMinutes;
      
      const newStop = {
        ...stop,
        travelTime: travelTimeStr,
        workTime: workTimeStr,
        arrivalTime: this.minutesToTime(arrivalInMinutes),
        departureTime: this.minutesToTime(departureInMinutes),
      };
      
      lastDepartureInMinutes = departureInMinutes;
      previousAgencyId = stop.agencyId;
      return newStop;
    });

    if (JSON.stringify(stops) !== JSON.stringify(updatedStops)) {
      this.scheduleStops.set(updatedStops);
    }
  }

  // --- Settings Management ---
  addOrUpdateAgency(): void {
    if (!this.newAgency.name) return;
    this.agencies.update(agencies => {
        const existing = agencies.find(a => a.id === this.newAgency.id);
        if (existing) {
            return agencies.map(a => a.id === this.newAgency.id ? {...this.newAgency} : a);
        } else {
            return [...agencies, { ...this.newAgency, id: Date.now() }];
        }
    });
    this.newAgency = this.resetNewAgency();
  }

  editAgency(agency: Agency): void {
    this.newAgency = {...agency};
  }

  deleteAgency(id: number): void {
    if (confirm('이 대리점을 삭제하시겠습니까? 관련된 스케줄 및 이동시간 데이터도 함께 삭제됩니다.')) {
        this.agencies.update(agencies => agencies.filter(a => a.id !== id));
        
        this.scheduleStops.update(stops => stops.map(stop => stop.agencyId === id ? { ...stop, agencyId: null } : stop).filter(stop => stop.agencyId !== id)
        );

        this.travelTimes.update(times => {
            const newTimes = {...times};
            Object.keys(newTimes).forEach(key => {
                const ids = key.split('-');
                if (ids.includes(String(id))) {
                    delete newTimes[key];
                }
            });
            return newTimes;
        });
    }
  }

  resetNewAgency(): Agency {
    return { id: 0, name: '', address: '', phone: '', memo: '' };
  }
  
  updateTravelTime(fromId: number, toId: number, minutes: number | null): void {
      this.travelTimes.update(times => {
          const newTimes = {...times};
          if (minutes === null || minutes < 0 || isNaN(minutes)) {
            delete newTimes[`${fromId}-${toId}`];
            delete newTimes[`${toId}-${fromId}`];
          } else {
            newTimes[`${fromId}-${toId}`] = minutes;
            newTimes[`${toId}-${fromId}`] = minutes; // Symmetrical
          }
          return newTimes;
      });
  }

  // --- Utility ---
  getAgencyName(agencyId: number | null): string {
    if (agencyId === null) return '선택...';
    return this.agencies().find(a => a.id === agencyId)?.name || '알 수 없음';
  }

  private timeToMinutes(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  minutesToTime(totalMinutes: number): string {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}