import { Component, input, output } from '@angular/core';
import { Period } from '@core/metrics/metric.model';
import { TranslationKey } from '@core/i18n/i18n.model';
import { TranslatePipe } from '@core/i18n/translate.pipe';

@Component({
  selector: 'app-period-switch',
  imports: [TranslatePipe],
  templateUrl: './period-switch.component.html',
  styleUrl: './period-switch.component.scss',
})
export class PeriodSwitchComponent {
  readonly value = input.required<Period>();
  readonly changed = output<Period>();

  protected readonly options: ReadonlyArray<{ value: Period; label: TranslationKey }> = [
    { value: 'week', label: 'period.week' },
    { value: 'month', label: 'period.month' },
    { value: 'quarter', label: 'period.quarter' },
    { value: 'year', label: 'period.year' },
  ];
}
