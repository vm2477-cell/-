
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScheduleComponent } from './components/schedule/schedule.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleComponent],
})
export class AppComponent {}
