import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-score-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score-card.component.html',
  styleUrl: './score-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreCardComponent {
  label = input.required<string>();
  score = input.required<number>();
  details = input<string[]>([]);
  issues = input<string[]>([]);

  scoreColor = computed(() => {
    const s = this.score();
    if (s >= 70) return '#198754'; // green
    if (s >= 40) return '#ffc107'; // yellow
    return '#dc3545'; // red
  });

  scoreLabel = computed(() => {
    const s = this.score();
    if (s >= 70) return 'Good';
    if (s >= 40) return 'Needs Work';
    return 'Poor';
  });
}
