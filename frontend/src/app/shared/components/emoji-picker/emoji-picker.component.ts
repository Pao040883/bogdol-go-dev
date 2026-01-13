import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonPopover,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSegment,
  IonSegmentButton,
  IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { happyOutline, heartOutline, flameOutline, thumbsUpOutline } from 'ionicons/icons';

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonIcon,
    IonPopover,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSegment,
    IonSegmentButton,
    IonLabel
  ],
  template: `
    <ion-button id="emoji-trigger" fill="clear" size="small">
      <ion-icon name="happy-outline" slot="icon-only"></ion-icon>
    </ion-button>

    <ion-popover trigger="emoji-trigger">
      <ng-template>
        <ion-content>
          <ion-segment [(ngModel)]="selectedCategory" scrollable>
            @for (category of categories; track category.name) {
              <ion-segment-button [value]="category.name">
                <ion-label>{{ category.icon }}</ion-label>
              </ion-segment-button>
            }
          </ion-segment>

          <ion-grid class="emoji-grid">
            <ion-row>
              @for (emoji of getCurrentEmojis(); track emoji) {
                <ion-col size="2" class="emoji-col">
                  <button class="emoji-button" (click)="selectEmoji(emoji)">
                    {{ emoji }}
                  </button>
                </ion-col>
              }
            </ion-row>
          </ion-grid>
        </ion-content>
      </ng-template>
    </ion-popover>
  `,
  styles: [`
    .emoji-grid {
      padding: 8px;
    }

    .emoji-col {
      padding: 4px;
    }

    .emoji-button {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 8px;
      border-radius: 4px;
      transition: background-color 0.2s;
      width: 100%;
      height: 100%;
    }

    .emoji-button:hover {
      background-color: var(--ion-color-light);
    }

    ion-content {
      --padding-top: 8px;
      --padding-bottom: 8px;
    }

    ion-segment {
      margin-bottom: 8px;
    }
  `]
})
export class EmojiPickerComponent {
  @Output() emojiSelected = new EventEmitter<string>();
  @ViewChild(IonPopover) popover!: IonPopover;

  selectedCategory = 'smileys';

  categories: EmojiCategory[] = [
    {
      name: 'smileys',
      icon: '😀',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔']
    },
    {
      name: 'gestures',
      icon: '👍',
      emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '✍️', '🤳']
    },
    {
      name: 'hearts',
      icon: '❤️',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
    },
    {
      name: 'symbols',
      icon: '✅',
      emojis: ['✅', '❌', '⭐', '🌟', '💯', '🔥', '💥', '⚡', '💫', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚠️', '🚨', '💡', '🔔', '📌', '📍', '🎯', '💬', '💭', '🗨️', '🗯️']
    },
    {
      name: 'misc',
      icon: '🎵',
      emojis: ['🎵', '🎶', '🎤', '🎧', '📱', '💻', '⌨️', '🖥️', '🖨️', '📷', '📹', '🎬', '📺', '📡', '🔋', '🔌', '💾', '💿', '📀', '🧮', '⏰', '⏱️', '⏲️', '🕰️', '⌚', '📅', '📆', '🗓️']
    }
  ];

  constructor() {
    addIcons({ happyOutline, heartOutline, flameOutline, thumbsUpOutline });
  }

  getCurrentEmojis(): string[] {
    const category = this.categories.find(c => c.name === this.selectedCategory);
    return category?.emojis || [];
  }

  selectEmoji(emoji: string): void {
    this.emojiSelected.emit(emoji);
    this.popover?.dismiss();
  }
}
