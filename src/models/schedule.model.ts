export interface ScheduleStop {
  id: number;
  agencyId: number | null;
  travelTime: string; // HH:mm
  arrivalTime: string; // HH:mm
  workTime: string; // HH:mm
  departureTime: string; // HH:mm
  boxes: number | null;
}

export interface Agency {
  id: number;
  name: string;
  address: string;
  phone: string;
  memo: string;
}
